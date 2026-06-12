import { quoteIdent, withDatabase } from "./postgres";

/* ------------------------------------------------------------------ *
 * Schema- and table-level privileges, plus extension management.
 * All operations run against a specific target database.
 * ------------------------------------------------------------------ */

const SCHEMA_PRIVS = ["USAGE", "CREATE"] as const;
export type SchemaPrivilege = (typeof SCHEMA_PRIVS)[number];

export interface SchemaPrivilegeRow {
  role: string;
  usage: boolean;
  create: boolean;
}

export async function getSchemaPrivileges(
  database: string,
  schema: string
): Promise<SchemaPrivilegeRow[]> {
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<{
      role: string;
      usage: boolean;
      create: boolean;
    }>(
      `select r.rolname as role,
              has_schema_privilege(r.rolname, $1, 'USAGE')  as usage,
              has_schema_privilege(r.rolname, $1, 'CREATE') as create
       from pg_roles r
       where r.rolname not like 'pg\\_%'
       order by r.rolname`,
      [schema]
    );
    return rows;
  });
}

export async function changeSchemaPrivilege(opts: {
  database: string;
  schema: string;
  role: string;
  privilege: SchemaPrivilege;
  grant: boolean;
}) {
  if (!SCHEMA_PRIVS.includes(opts.privilege))
    throw new Error(`Unsupported schema privilege: ${opts.privilege}`);
  const schema = quoteIdent(opts.schema);
  const role = quoteIdent(opts.role);
  await withDatabase(opts.database, async (client) => {
    if (opts.grant) {
      await client.query(`GRANT ${opts.privilege} ON SCHEMA ${schema} TO ${role}`);
    } else {
      await client.query(
        `REVOKE ${opts.privilege} ON SCHEMA ${schema} FROM ${role}`
      );
    }
  });
}

const TABLE_PRIVS = [
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "TRUNCATE",
  "REFERENCES",
  "TRIGGER",
] as const;
export type TablePrivilege = (typeof TABLE_PRIVS)[number];

export interface TablePrivilegeRow {
  role: string;
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  truncate: boolean;
  references: boolean;
  trigger: boolean;
}

export async function getTablePrivileges(
  database: string,
  schema: string,
  table: string
): Promise<TablePrivilegeRow[]> {
  const rel = `${schema}.${table}`;
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<TablePrivilegeRow>(
      `select r.rolname as role,
              has_table_privilege(r.rolname, $1, 'SELECT')     as select,
              has_table_privilege(r.rolname, $1, 'INSERT')     as insert,
              has_table_privilege(r.rolname, $1, 'UPDATE')     as update,
              has_table_privilege(r.rolname, $1, 'DELETE')     as delete,
              has_table_privilege(r.rolname, $1, 'TRUNCATE')   as truncate,
              has_table_privilege(r.rolname, $1, 'REFERENCES') as references,
              has_table_privilege(r.rolname, $1, 'TRIGGER')    as trigger
       from pg_roles r
       where r.rolname not like 'pg\\_%'
       order by r.rolname`,
      [rel]
    );
    return rows;
  });
}

export async function changeTablePrivilege(opts: {
  database: string;
  schema: string;
  table: string;
  role: string;
  privilege: TablePrivilege;
  grant: boolean;
}) {
  if (!TABLE_PRIVS.includes(opts.privilege))
    throw new Error(`Unsupported table privilege: ${opts.privilege}`);
  const rel = `${quoteIdent(opts.schema)}.${quoteIdent(opts.table)}`;
  const role = quoteIdent(opts.role);
  await withDatabase(opts.database, async (client) => {
    if (opts.grant) {
      await client.query(`GRANT ${opts.privilege} ON TABLE ${rel} TO ${role}`);
    } else {
      await client.query(`REVOKE ${opts.privilege} ON TABLE ${rel} FROM ${role}`);
    }
  });
}

/**
 * Bulk convenience: grant/revoke all privileges on every table in a schema to
 * a role (and optionally set default privileges for future tables).
 */
export async function grantAllOnSchema(opts: {
  database: string;
  schema: string;
  role: string;
  grant: boolean;
  includeFuture: boolean;
}) {
  const schema = quoteIdent(opts.schema);
  const role = quoteIdent(opts.role);
  await withDatabase(opts.database, async (client) => {
    if (opts.grant) {
      await client.query(`GRANT USAGE ON SCHEMA ${schema} TO ${role}`);
      await client.query(
        `GRANT ALL ON ALL TABLES IN SCHEMA ${schema} TO ${role}`
      );
      await client.query(
        `GRANT ALL ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`
      );
      if (opts.includeFuture) {
        await client.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON TABLES TO ${role}`
        );
        await client.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} GRANT ALL ON SEQUENCES TO ${role}`
        );
      }
    } else {
      await client.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA ${schema} FROM ${role}`
      );
      await client.query(
        `REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${schema} FROM ${role}`
      );
      if (opts.includeFuture) {
        await client.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON TABLES FROM ${role}`
        );
        await client.query(
          `ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM ${role}`
        );
      }
    }
  });
}

/* ------------------------------- Extensions ------------------------------- */

export interface ExtensionInfo {
  name: string;
  installedVersion: string | null;
  defaultVersion: string | null;
  comment: string | null;
}

export async function listExtensions(
  database: string
): Promise<ExtensionInfo[]> {
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<{
      name: string;
      installed_version: string | null;
      default_version: string | null;
      comment: string | null;
    }>(
      `select a.name,
              i.extversion as installed_version,
              a.default_version,
              a.comment
       from pg_available_extensions a
       left join pg_extension i on i.extname = a.name
       order by (i.extversion is not null) desc, a.name`
    );
    return rows.map((r) => ({
      name: r.name,
      installedVersion: r.installed_version,
      defaultVersion: r.default_version,
      comment: r.comment,
    }));
  });
}

export async function createExtension(database: string, name: string) {
  await withDatabase(database, async (client) => {
    await client.query(`CREATE EXTENSION IF NOT EXISTS ${quoteIdent(name)}`);
  });
}

export async function dropExtension(database: string, name: string) {
  await withDatabase(database, async (client) => {
    await client.query(`DROP EXTENSION IF EXISTS ${quoteIdent(name)}`);
  });
}
