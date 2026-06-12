import { Pool, Client, PoolClient, QueryResultRow, FieldDef } from "pg";
import crypto from "crypto";

/**
 * Connection configuration is read from the environment. We connect to a
 * "maintenance" database (default: postgres) as a privileged role so the GUI
 * can manage databases, roles, permissions and passwords.
 */
function connectionConfig() {
  const ssl =
    String(process.env.PGSSL).toLowerCase() === "true"
      ? { rejectUnauthorized: false }
      : undefined;

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl };
  }

  return {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD ?? "",
    database: process.env.PGDATABASE || "postgres",
    ssl,
  };
}

/**
 * Resolved connection details (host/port/user/password/database) regardless of
 * whether the config came from DATABASE_URL or the individual PG* variables.
 * Used to build the environment for pg_dump / pg_restore / psql subprocesses.
 */
export function resolveConnection() {
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    return {
      host: u.hostname || "localhost",
      port: u.port ? parseInt(u.port, 10) : 5432,
      user: decodeURIComponent(u.username) || "postgres",
      password: decodeURIComponent(u.password) || "",
      database: u.pathname.replace(/^\//, "") || "postgres",
    };
  }
  return {
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432", 10),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD ?? "",
    database: process.env.PGDATABASE || "postgres",
  };
}

function getPool(): Pool {
  if (!globalForPg.__pgPool) {
    const pool = new Pool({ ...connectionConfig(), max: 5 });
    // Prevent an unhandled idle-client error from crashing the process.
    pool.on("error", (err) => {
      console.error("Unexpected idle Postgres client error:", err.message);
    });
    globalForPg.__pgPool = pool;
  }
  return globalForPg.__pgPool;
}

// Singleton pool for the maintenance database. Cached on globalThis so it
// survives Next.js hot-reloads in development.
const globalForPg = globalThis as unknown as { __pgPool?: Pool };

/* ------------------------------------------------------------------ *
 * Identifier / literal escaping
 *
 * Database and role names arrive from the UI and are interpolated into DDL
 * statements that cannot use bind parameters (CREATE DATABASE, CREATE ROLE,
 * GRANT, ...). We quote them safely instead of trusting the input.
 * ------------------------------------------------------------------ */

export function quoteIdent(name: string): string {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("Identifier must be a non-empty string");
  }
  if (name.includes("\0")) {
    throw new Error("Identifier must not contain null bytes");
  }
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string): string {
  if (typeof value !== "string") {
    throw new Error("Value must be a string");
  }
  if (value.includes("\0")) {
    throw new Error("Value must not contain null bytes");
  }
  return `'${value.replace(/'/g, "''")}'`;
}

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return getPool().query<T>(text, params);
}

/**
 * Run a function with a dedicated client connected to a *specific* database.
 * Needed for operations that are scoped to a database other than the
 * maintenance one (e.g. the SQL console, schema-level grants).
 */
export async function withDatabase<T>(
  database: string | undefined,
  fn: (client: PoolClient | Client) => Promise<T>
): Promise<T> {
  // No specific database requested -> use the pool's maintenance connection.
  if (!database || database === (process.env.PGDATABASE || "postgres")) {
    const client = await getPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  }

  const client = new Client({ ...connectionConfig(), database });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/* ------------------------------------------------------------------ *
 * Server / status
 * ------------------------------------------------------------------ */

export async function getStatus() {
  const pool = getPool();
  const [version, user, activity, counts] = await Promise.all([
    pool.query<{ version: string; server_version: string }>(
      "select version() as version, current_setting('server_version') as server_version"
    ),
    pool.query<{
      current_user: string;
      is_superuser: string;
      start_time: string;
      uptime: string;
    }>(
      `select current_user,
              current_setting('is_superuser') as is_superuser,
              pg_postmaster_start_time()::text as start_time,
              (now() - pg_postmaster_start_time())::text as uptime`
    ),
    pool.query<{ total: string; active: string; max_conn: string }>(
      `select count(*)::text as total,
              count(*) filter (where state = 'active')::text as active,
              current_setting('max_connections') as max_conn
       from pg_stat_activity`
    ),
    pool.query<{ databases: string; roles: string }>(
      `select (select count(*) from pg_database where not datistemplate)::text as databases,
              (select count(*) from pg_roles)::text as roles`
    ),
  ]);

  return {
    version: version.rows[0].version,
    serverVersion: version.rows[0].server_version,
    currentUser: user.rows[0].current_user,
    isSuperuser: user.rows[0].is_superuser === "on",
    startTime: user.rows[0].start_time,
    uptime: user.rows[0].uptime,
    connections: {
      total: parseInt(activity.rows[0].total, 10),
      active: parseInt(activity.rows[0].active, 10),
      max: parseInt(activity.rows[0].max_conn, 10),
    },
    databaseCount: parseInt(counts.rows[0].databases, 10),
    roleCount: parseInt(counts.rows[0].roles, 10),
  };
}

/* ------------------------------------------------------------------ *
 * Databases
 * ------------------------------------------------------------------ */

export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  collate: string | null;
  ctype: string | null;
  size: string;
  sizeBytes: number;
  connections: number;
  isTemplate: boolean;
  allowConnections: boolean;
}

export async function listDatabases(): Promise<DatabaseInfo[]> {
  const { rows } = await query<{
    name: string;
    owner: string;
    encoding: string;
    collate: string | null;
    ctype: string | null;
    size: string;
    size_bytes: string;
    connections: string;
    is_template: boolean;
    allow_conn: boolean;
  }>(
    `select d.datname                                   as name,
            pg_catalog.pg_get_userbyid(d.datdba)        as owner,
            pg_catalog.pg_encoding_to_char(d.encoding)  as encoding,
            d.datcollate                                as collate,
            d.datctype                                  as ctype,
            case when has_database_privilege(d.datname, 'CONNECT')
                 then pg_size_pretty(pg_database_size(d.datname))
                 else 'n/a' end                         as size,
            case when has_database_privilege(d.datname, 'CONNECT')
                 then pg_database_size(d.datname)::text
                 else '0' end                           as size_bytes,
            (select count(*) from pg_stat_activity a where a.datname = d.datname)::text as connections,
            d.datistemplate                             as is_template,
            d.datallowconn                              as allow_conn
     from pg_database d
     order by d.datname`
  );

  return rows.map((r) => ({
    name: r.name,
    owner: r.owner,
    encoding: r.encoding,
    collate: r.collate,
    ctype: r.ctype,
    size: r.size,
    sizeBytes: parseInt(r.size_bytes, 10),
    connections: parseInt(r.connections, 10),
    isTemplate: r.is_template,
    allowConnections: r.allow_conn,
  }));
}

export async function createDatabase(opts: {
  name: string;
  owner?: string;
  encoding?: string;
  template?: string;
}) {
  let sql = `CREATE DATABASE ${quoteIdent(opts.name)}`;
  const withParts: string[] = [];
  if (opts.owner) withParts.push(`OWNER ${quoteIdent(opts.owner)}`);
  if (opts.template) withParts.push(`TEMPLATE ${quoteIdent(opts.template)}`);
  if (opts.encoding) {
    withParts.push(`ENCODING ${quoteLiteral(opts.encoding)}`);
    // A non-default encoding requires template0.
    if (!opts.template) withParts.push(`TEMPLATE template0`);
  }
  if (withParts.length) sql += ` WITH ${withParts.join(" ")}`;
  await query(sql);
}

export async function dropDatabase(name: string, force = false) {
  // FORCE (terminate other sessions) is supported on PG 13+.
  await query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}${force ? " WITH (FORCE)" : ""}`);
}

/* ------------------------------------------------------------------ *
 * Roles / users
 * ------------------------------------------------------------------ */

export interface RoleInfo {
  name: string;
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  canLogin: boolean;
  replication: boolean;
  inherit: boolean;
  connectionLimit: number;
  validUntil: string | null;
  memberOf: string[];
}

export async function listRoles(): Promise<RoleInfo[]> {
  const { rows } = await query<{
    name: string;
    superuser: boolean;
    createdb: boolean;
    createrole: boolean;
    canlogin: boolean;
    replication: boolean;
    inherit: boolean;
    conn_limit: number;
    valid_until: string | null;
    member_of: string[] | null;
  }>(
    `select r.rolname                       as name,
            r.rolsuper                       as superuser,
            r.rolcreatedb                    as createdb,
            r.rolcreaterole                  as createrole,
            r.rolcanlogin                    as canlogin,
            r.rolreplication                 as replication,
            r.rolinherit                     as inherit,
            r.rolconnlimit                   as conn_limit,
            r.rolvaliduntil::text            as valid_until,
            array(select g.rolname
                  from pg_auth_members m
                  join pg_roles g on g.oid = m.roleid
                  where m.member = r.oid
                  order by g.rolname)        as member_of
     from pg_roles r
     order by r.rolname`
  );

  return rows.map((r) => ({
    name: r.name,
    superuser: r.superuser,
    createDb: r.createdb,
    createRole: r.createrole,
    canLogin: r.canlogin,
    replication: r.replication,
    inherit: r.inherit,
    connectionLimit: r.conn_limit,
    validUntil: r.valid_until,
    memberOf: r.member_of ?? [],
  }));
}

export interface RoleAttributes {
  login?: boolean;
  superuser?: boolean;
  createDb?: boolean;
  createRole?: boolean;
  replication?: boolean;
  inherit?: boolean;
  connectionLimit?: number;
  validUntil?: string | null;
}

function attributeClauses(attrs: RoleAttributes): string[] {
  const parts: string[] = [];
  if (attrs.login !== undefined) parts.push(attrs.login ? "LOGIN" : "NOLOGIN");
  if (attrs.superuser !== undefined)
    parts.push(attrs.superuser ? "SUPERUSER" : "NOSUPERUSER");
  if (attrs.createDb !== undefined)
    parts.push(attrs.createDb ? "CREATEDB" : "NOCREATEDB");
  if (attrs.createRole !== undefined)
    parts.push(attrs.createRole ? "CREATEROLE" : "NOCREATEROLE");
  if (attrs.replication !== undefined)
    parts.push(attrs.replication ? "REPLICATION" : "NOREPLICATION");
  if (attrs.inherit !== undefined)
    parts.push(attrs.inherit ? "INHERIT" : "NOINHERIT");
  if (attrs.connectionLimit !== undefined)
    parts.push(`CONNECTION LIMIT ${parseInt(String(attrs.connectionLimit), 10)}`);
  if (attrs.validUntil !== undefined) {
    parts.push(
      attrs.validUntil
        ? `VALID UNTIL ${quoteLiteral(attrs.validUntil)}`
        : `VALID UNTIL 'infinity'`
    );
  }
  return parts;
}

export async function createRole(opts: {
  name: string;
  password?: string;
  attrs?: RoleAttributes;
}) {
  const clauses = attributeClauses(opts.attrs ?? {});
  if (opts.password) {
    clauses.unshift(`PASSWORD ${quoteLiteral(opts.password)}`);
  }
  const sql =
    `CREATE ROLE ${quoteIdent(opts.name)}` +
    (clauses.length ? ` WITH ${clauses.join(" ")}` : "");
  await query(sql);
}

export async function alterRole(name: string, attrs: RoleAttributes) {
  const clauses = attributeClauses(attrs);
  if (!clauses.length) return;
  await query(`ALTER ROLE ${quoteIdent(name)} WITH ${clauses.join(" ")}`);
}

export async function setRolePassword(
  name: string,
  password: string,
  validUntil?: string | null
) {
  let sql = `ALTER ROLE ${quoteIdent(name)} WITH PASSWORD ${quoteLiteral(password)}`;
  if (validUntil !== undefined && validUntil !== null && validUntil !== "") {
    sql += ` VALID UNTIL ${quoteLiteral(validUntil)}`;
  }
  await query(sql);
}

export async function dropRole(name: string) {
  await query(`DROP ROLE IF EXISTS ${quoteIdent(name)}`);
}

export async function setRoleMembership(opts: {
  role: string;
  group: string;
  grant: boolean;
}) {
  if (opts.grant) {
    await query(`GRANT ${quoteIdent(opts.group)} TO ${quoteIdent(opts.role)}`);
  } else {
    await query(`REVOKE ${quoteIdent(opts.group)} FROM ${quoteIdent(opts.role)}`);
  }
}

/* ------------------------------------------------------------------ *
 * Database-level privileges
 * ------------------------------------------------------------------ */

const DB_PRIVILEGES = ["CONNECT", "CREATE", "TEMPORARY"] as const;
export type DbPrivilege = (typeof DB_PRIVILEGES)[number];

export interface DatabasePrivilegeRow {
  role: string;
  connect: boolean;
  create: boolean;
  temporary: boolean;
}

export async function getDatabasePrivileges(
  database: string
): Promise<DatabasePrivilegeRow[]> {
  const { rows } = await query<{
    role: string;
    connect: boolean;
    create: boolean;
    temporary: boolean;
  }>(
    `select r.rolname as role,
            has_database_privilege(r.rolname, $1, 'CONNECT')    as connect,
            has_database_privilege(r.rolname, $1, 'CREATE')     as create,
            has_database_privilege(r.rolname, $1, 'TEMPORARY')  as temporary
     from pg_roles r
     where r.rolname not like 'pg\\_%'
     order by r.rolname`,
    [database]
  );
  return rows;
}

export async function changeDatabasePrivilege(opts: {
  database: string;
  role: string;
  privilege: DbPrivilege;
  grant: boolean;
}) {
  if (!DB_PRIVILEGES.includes(opts.privilege)) {
    throw new Error(`Unsupported privilege: ${opts.privilege}`);
  }
  const db = quoteIdent(opts.database);
  const role = quoteIdent(opts.role);
  if (opts.grant) {
    await query(`GRANT ${opts.privilege} ON DATABASE ${db} TO ${role}`);
  } else {
    await query(`REVOKE ${opts.privilege} ON DATABASE ${db} FROM ${role}`);
  }
}

/* ------------------------------------------------------------------ *
 * Arbitrary SQL (console)
 * ------------------------------------------------------------------ */

export async function runSql(sql: string, database?: string) {
  return withDatabase(database, async (client) => {
    const result = await client.query<QueryResultRow>(sql);
    // Multi-statement queries return an array of results; surface the last one.
    const r = Array.isArray(result) ? result[result.length - 1] : result;
    return {
      command: r.command as string | undefined,
      rowCount: r.rowCount as number | null,
      fields: (r.fields ?? []).map((f: FieldDef) => f.name),
      rows: (r.rows ?? []) as Record<string, unknown>[],
    };
  });
}

/* ------------------------------------------------------------------ *
 * Secure password generation
 * ------------------------------------------------------------------ */

export function generatePassword(length = 24): string {
  // Avoid ambiguous characters; keep it shell/URL friendly.
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%^&*-_=+";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
