import { quoteIdent, withDatabase } from "./postgres";

/* ------------------------------------------------------------------ *
 * Schema / table introspection and row-level CRUD for the data browser.
 * Every operation runs against a specific target database.
 * ------------------------------------------------------------------ */

export interface SchemaInfo {
  name: string;
  owner: string;
  isSystem: boolean;
}

export async function listSchemas(database: string): Promise<SchemaInfo[]> {
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<{
      name: string;
      owner: string;
    }>(
      `select n.nspname as name, pg_catalog.pg_get_userbyid(n.nspowner) as owner
       from pg_namespace n
       where n.nspname not like 'pg_temp%' and n.nspname not like 'pg_toast%'
       order by n.nspname`
    );
    return rows.map((r) => ({
      name: r.name,
      owner: r.owner,
      isSystem:
        r.name === "information_schema" || r.name.startsWith("pg_"),
    }));
  });
}

export interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view" | "matview" | "partitioned" | "foreign";
  owner: string;
  rowEstimate: number;
  size: string;
}

export async function listTables(
  database: string,
  schema: string
): Promise<TableInfo[]> {
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<{
      schema: string;
      name: string;
      kind: string;
      owner: string;
      row_estimate: string;
      size: string;
    }>(
      `select n.nspname as schema,
              c.relname as name,
              c.relkind as kind,
              pg_catalog.pg_get_userbyid(c.relowner) as owner,
              c.reltuples::bigint::text as row_estimate,
              pg_size_pretty(pg_total_relation_size(c.oid)) as size
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relkind in ('r','v','m','p','f')
       order by c.relname`,
      [schema]
    );
    const kindMap: Record<string, TableInfo["type"]> = {
      r: "table",
      v: "view",
      m: "matview",
      p: "partitioned",
      f: "foreign",
    };
    return rows.map((r) => ({
      schema: r.schema,
      name: r.name,
      type: kindMap[r.kind] ?? "table",
      owner: r.owner,
      rowEstimate: Math.max(0, parseInt(r.row_estimate, 10) || 0),
      size: r.size,
    }));
  });
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
}

export interface IndexInfo {
  name: string;
  definition: string;
  primary: boolean;
  unique: boolean;
}

export async function getTableDetails(
  database: string,
  schema: string,
  table: string
): Promise<{ columns: ColumnInfo[]; indexes: IndexInfo[]; primaryKey: string[] }> {
  return withDatabase(database, async (client) => {
    const columns = await client.query<{
      name: string;
      type: string;
      nullable: boolean;
      default: string | null;
      is_pk: boolean;
    }>(
      `select a.attname as name,
              pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
              not a.attnotnull as nullable,
              pg_get_expr(d.adbin, d.adrelid) as default,
              coalesce(pk.is_pk, false) as is_pk
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
       left join (
         select unnest(i.indkey) as attnum, true as is_pk
         from pg_index i
         join pg_class ic on ic.oid = i.indrelid
         join pg_namespace ins on ins.oid = ic.relnamespace
         where ic.relname = $2 and ins.nspname = $1 and i.indisprimary
       ) pk on pk.attnum = a.attnum
       where n.nspname = $1 and c.relname = $2
         and a.attnum > 0 and not a.attisdropped
       order by a.attnum`,
      [schema, table]
    );

    const indexes = await client.query<{
      name: string;
      def: string;
      primary: boolean;
      unique: boolean;
    }>(
      `select ic.relname as name,
              pg_get_indexdef(i.indexrelid) as def,
              i.indisprimary as primary,
              i.indisunique as unique
       from pg_index i
       join pg_class ic on ic.oid = i.indexrelid
       join pg_class tc on tc.oid = i.indrelid
       join pg_namespace n on n.oid = tc.relnamespace
       where n.nspname = $1 and tc.relname = $2
       order by ic.relname`,
      [schema, table]
    );

    const cols = columns.rows.map((r) => ({
      name: r.name,
      type: r.type,
      nullable: r.nullable,
      default: r.default,
      isPrimaryKey: r.is_pk,
    }));

    return {
      columns: cols,
      indexes: indexes.rows.map((r) => ({
        name: r.name,
        definition: r.def,
        primary: r.primary,
        unique: r.unique,
      })),
      primaryKey: cols.filter((c) => c.isPrimaryKey).map((c) => c.name),
    };
  });
}

const ALLOWED_ORDER_DIR = new Set(["ASC", "DESC"]);

export async function getTableData(
  database: string,
  schema: string,
  table: string,
  opts: { limit?: number; offset?: number; orderBy?: string; orderDir?: string } = {}
): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
  primaryKey: string[];
  rowEstimate: number;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 1000);
  const offset = Math.max(opts.offset ?? 0, 0);

  return withDatabase(database, async (client) => {
    // Validate the requested order column against real columns to be safe.
    const colsRes = await client.query<{ name: string }>(
      `select a.attname as name
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relname = $2 and a.attnum > 0 and not a.attisdropped`,
      [schema, table]
    );
    const validCols = new Set(colsRes.rows.map((r) => r.name));

    const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
    let orderClause = "";
    if (opts.orderBy && validCols.has(opts.orderBy)) {
      const dir = ALLOWED_ORDER_DIR.has(String(opts.orderDir).toUpperCase())
        ? String(opts.orderDir).toUpperCase()
        : "ASC";
      orderClause = ` order by ${quoteIdent(opts.orderBy)} ${dir}`;
    }

    const dataRes = await client.query(
      `select * from ${rel}${orderClause} limit ${limit} offset ${offset}`
    );

    const estRes = await client.query<{ est: string }>(
      `select reltuples::bigint::text as est
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = $1 and c.relname = $2`,
      [schema, table]
    );

    return {
      columns: dataRes.fields.map((f) => f.name),
      rows: dataRes.rows as Record<string, unknown>[],
      primaryKey: await getPrimaryKey(database, schema, table),
      rowEstimate: Math.max(0, parseInt(estRes.rows[0]?.est ?? "0", 10) || 0),
    };
  });
}

async function getPrimaryKey(
  database: string,
  schema: string,
  table: string
): Promise<string[]> {
  return withDatabase(database, async (client) => {
    const { rows } = await client.query<{ name: string }>(
      `select a.attname as name
       from pg_index i
       join pg_class c on c.oid = i.indrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_attribute a on a.attrelid = c.oid and a.attnum = any(i.indkey)
       where n.nspname = $1 and c.relname = $2 and i.indisprimary
       order by array_position(i.indkey, a.attnum)`,
      [schema, table]
    );
    return rows.map((r) => r.name);
  });
}

/** Build a WHERE clause from a primary-key value map using bind params. */
function pkWhere(pk: Record<string, unknown>, startIdx = 1) {
  const keys = Object.keys(pk);
  const clause = keys
    .map((k, i) => `${quoteIdent(k)} = $${startIdx + i}`)
    .join(" and ");
  return { clause, values: keys.map((k) => pk[k]) };
}

export async function insertRow(
  database: string,
  schema: string,
  table: string,
  values: Record<string, unknown>
) {
  const keys = Object.keys(values);
  if (!keys.length) throw new Error("No values provided");
  const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const cols = keys.map(quoteIdent).join(", ");
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  return withDatabase(database, async (client) => {
    const res = await client.query(
      `insert into ${rel} (${cols}) values (${placeholders}) returning *`,
      keys.map((k) => values[k])
    );
    return res.rows[0];
  });
}

export async function updateRow(
  database: string,
  schema: string,
  table: string,
  pk: Record<string, unknown>,
  values: Record<string, unknown>
) {
  const keys = Object.keys(values);
  if (!keys.length) throw new Error("No values to update");
  const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const setClause = keys.map((k, i) => `${quoteIdent(k)} = $${i + 1}`).join(", ");
  const { clause, values: pkValues } = pkWhere(pk, keys.length + 1);
  return withDatabase(database, async (client) => {
    const res = await client.query(
      `update ${rel} set ${setClause} where ${clause} returning *`,
      [...keys.map((k) => values[k]), ...pkValues]
    );
    if (res.rowCount === 0) throw new Error("Row not found (it may have changed)");
    return res.rows[0];
  });
}

export async function deleteRow(
  database: string,
  schema: string,
  table: string,
  pk: Record<string, unknown>
) {
  const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const { clause, values } = pkWhere(pk);
  return withDatabase(database, async (client) => {
    const res = await client.query(
      `delete from ${rel} where ${clause}`,
      values
    );
    if (res.rowCount === 0) throw new Error("Row not found (it may have changed)");
  });
}

export async function truncateTable(
  database: string,
  schema: string,
  table: string
) {
  const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  await withDatabase(database, async (client) => {
    await client.query(`truncate table ${rel}`);
  });
}

export async function dropTable(
  database: string,
  schema: string,
  table: string,
  kind: TableInfo["type"]
) {
  const rel = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const obj =
    kind === "view" ? "view" : kind === "matview" ? "materialized view" : "table";
  await withDatabase(database, async (client) => {
    await client.query(`drop ${obj} if exists ${rel} cascade`);
  });
}
