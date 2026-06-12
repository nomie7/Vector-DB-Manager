"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Select, Label, Toggle, Button, Badge } from "@/components/ui";
import { DatabaseInfo, DatabasePrivilegeRow, Notify } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ShieldCheck, Puzzle, Plus, Trash2 } from "lucide-react";

type Section = "database" | "schema" | "table" | "extensions";

export default function Permissions({ notify }: { notify: Notify }) {
  const [section, setSection] = useState<Section>("database");
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [database, setDatabase] = useState("");

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((d) => {
        const dbs = (d.databases || []).filter(
          (x: DatabaseInfo) => !x.isTemplate
        );
        setDatabases(dbs);
        if (dbs.length) setDatabase(dbs[0].name);
      })
      .catch((e) => notify((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Permissions</h2>
          <p className="text-xs text-muted">
            Manage privileges at the database, schema and table level, plus
            extensions.
          </p>
        </div>
        <div className="w-56">
          <Label>Database</Label>
          <Select value={database} onChange={(e) => setDatabase(e.target.value)}>
            {databases.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["database", "Database"],
            ["schema", "Schema"],
            ["table", "Table"],
            ["extensions", "Extensions"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setSection(id)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm",
              section === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "database" && (
        <DatabasePrivs database={database} notify={notify} />
      )}
      {section === "schema" && (
        <SchemaPrivs database={database} notify={notify} />
      )}
      {section === "table" && <TablePrivs database={database} notify={notify} />}
      {section === "extensions" && (
        <Extensions database={database} notify={notify} />
      )}
    </div>
  );
}

/* ---------------- shared helpers ---------------- */

function useSchemas(database: string) {
  const [schemas, setSchemas] = useState<{ name: string; isSystem: boolean }[]>(
    []
  );
  useEffect(() => {
    if (!database) return;
    fetch(`/api/schemas?database=${encodeURIComponent(database)}`)
      .then((r) => r.json())
      .then((d) => setSchemas(d.schemas || []))
      .catch(() => {});
  }, [database]);
  return schemas;
}

function PrivGrid<T extends { role: string }>({
  rows,
  privs,
  onToggle,
}: {
  rows: T[];
  privs: { key: keyof T; label: string; priv: string }[];
  onToggle: (role: string, priv: string, grant: boolean) => void;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-4 py-2.5 font-medium">Role</th>
            {privs.map((p) => (
              <th key={p.priv} className="px-3 py-2.5 text-center font-medium">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.role}
              className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
            >
              <td className="px-4 py-2 font-mono text-xs">{row.role}</td>
              {privs.map((p) => (
                <td key={p.priv} className="px-3 py-2">
                  <div className="flex justify-center">
                    <Toggle
                      checked={Boolean(row[p.key])}
                      onChange={(v) => onToggle(row.role, p.priv, v)}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={privs.length + 1}
                className="px-4 py-8 text-center text-muted"
              >
                <ShieldCheck className="mx-auto mb-2 opacity-40" />
                Nothing to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

/* ---------------- Database-level ---------------- */

function DatabasePrivs({
  database,
  notify,
}: {
  database: string;
  notify: Notify;
}) {
  const [rows, setRows] = useState<DatabasePrivilegeRow[]>([]);
  const load = useCallback(() => {
    if (!database) return;
    fetch(`/api/privileges?database=${encodeURIComponent(database)}`)
      .then((r) => r.json())
      .then((d) => setRows(d.privileges || []))
      .catch((e) => notify((e as Error).message, "error"));
  }, [database, notify]);
  useEffect(() => load(), [load]);

  async function toggle(role: string, privilege: string, grant: boolean) {
    const res = await fetch("/api/privileges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database, role, privilege, grant }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Failed", "error");
    notify(`${grant ? "Granted" : "Revoked"} ${privilege}`, "success");
    load();
  }

  return (
    <PrivGrid
      rows={rows}
      privs={[
        { key: "connect", priv: "CONNECT", label: "Connect" },
        { key: "create", priv: "CREATE", label: "Create" },
        { key: "temporary", priv: "TEMPORARY", label: "Temp" },
      ]}
      onToggle={toggle}
    />
  );
}

/* ---------------- Schema-level ---------------- */

interface SchemaPrivRow {
  role: string;
  usage: boolean;
  create: boolean;
}

function SchemaPrivs({
  database,
  notify,
}: {
  database: string;
  notify: Notify;
}) {
  const schemas = useSchemas(database);
  const [schema, setSchema] = useState("");
  const [rows, setRows] = useState<SchemaPrivRow[]>([]);
  const [bulkRole, setBulkRole] = useState("");
  const [includeFuture, setIncludeFuture] = useState(true);

  useEffect(() => {
    if (schemas.length && !schema) {
      setSchema(schemas.find((s) => s.name === "public")?.name || schemas[0].name);
    }
  }, [schemas, schema]);

  const load = useCallback(() => {
    if (!database || !schema) return;
    fetch(
      `/api/permissions/schema?database=${encodeURIComponent(
        database
      )}&schema=${encodeURIComponent(schema)}`
    )
      .then((r) => r.json())
      .then((d) => setRows(d.privileges || []))
      .catch((e) => notify((e as Error).message, "error"));
  }, [database, schema, notify]);
  useEffect(() => load(), [load]);

  async function toggle(role: string, privilege: string, grant: boolean) {
    const res = await fetch("/api/permissions/schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database, schema, role, privilege, grant }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Failed", "error");
    notify(`${grant ? "Granted" : "Revoked"} ${privilege} on ${schema}`, "success");
    load();
  }

  async function bulk(grant: boolean) {
    if (!bulkRole) return notify("Pick a role first", "error");
    const res = await fetch("/api/permissions/schema", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database,
        schema,
        role: bulkRole,
        grant,
        bulk: true,
        includeFuture,
      }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Failed", "error");
    notify(
      `${grant ? "Granted" : "Revoked"} ALL on schema ${schema} ${
        grant ? "to" : "from"
      } ${bulkRole}`,
      "success"
    );
    load();
  }

  return (
    <div className="space-y-3">
      <div className="w-56">
        <Label>Schema</Label>
        <Select value={schema} onChange={(e) => setSchema(e.target.value)}>
          {schemas.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
              {s.isSystem ? " (system)" : ""}
            </option>
          ))}
        </Select>
      </div>

      <PrivGrid
        rows={rows}
        privs={[
          { key: "usage", priv: "USAGE", label: "Usage" },
          { key: "create", priv: "CREATE", label: "Create" },
        ]}
        onToggle={toggle}
      />

      <Card className="p-4">
        <h4 className="mb-2 text-sm font-semibold">
          Bulk grant on all tables &amp; sequences
        </h4>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <Label>Role</Label>
            <Select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
              <option value="">Select a role…</option>
              {rows.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.role}
                </option>
              ))}
            </Select>
          </div>
          <Toggle
            checked={includeFuture}
            onChange={setIncludeFuture}
            label="Include future objects"
          />
          <Button variant="primary" size="sm" onClick={() => bulk(true)}>
            Grant ALL
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulk(false)}>
            Revoke ALL
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-muted">
          Grants USAGE on the schema plus ALL privileges on every existing table
          and sequence. &ldquo;Include future objects&rdquo; also sets default
          privileges for newly created ones.
        </p>
      </Card>
    </div>
  );
}

/* ---------------- Table-level ---------------- */

interface TablePrivRow {
  role: string;
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  truncate: boolean;
  references: boolean;
  trigger: boolean;
}

function TablePrivs({ database, notify }: { database: string; notify: Notify }) {
  const schemas = useSchemas(database);
  const [schema, setSchema] = useState("");
  const [tables, setTables] = useState<{ name: string }[]>([]);
  const [table, setTable] = useState("");
  const [rows, setRows] = useState<TablePrivRow[]>([]);

  useEffect(() => {
    if (schemas.length && !schema)
      setSchema(schemas.find((s) => s.name === "public")?.name || schemas[0].name);
  }, [schemas, schema]);

  useEffect(() => {
    if (!database || !schema) return;
    setTable("");
    fetch(
      `/api/tables?database=${encodeURIComponent(
        database
      )}&schema=${encodeURIComponent(schema)}`
    )
      .then((r) => r.json())
      .then((d) => {
        const list = (d.tables || []).filter(
          (t: { type: string }) => t.type === "table" || t.type === "view"
        );
        setTables(list);
        if (list.length) setTable(list[0].name);
      })
      .catch(() => {});
  }, [database, schema]);

  const load = useCallback(() => {
    if (!database || !schema || !table) return setRows([]);
    fetch(
      `/api/permissions/table?database=${encodeURIComponent(
        database
      )}&schema=${encodeURIComponent(schema)}&table=${encodeURIComponent(table)}`
    )
      .then((r) => r.json())
      .then((d) => setRows(d.privileges || []))
      .catch((e) => notify((e as Error).message, "error"));
  }, [database, schema, table, notify]);
  useEffect(() => load(), [load]);

  async function toggle(role: string, privilege: string, grant: boolean) {
    const res = await fetch("/api/permissions/table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database, schema, table, role, privilege, grant }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Failed", "error");
    notify(`${grant ? "Granted" : "Revoked"} ${privilege} on ${table}`, "success");
    load();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Label>Schema</Label>
          <Select value={schema} onChange={(e) => setSchema(e.target.value)}>
            {schemas.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-56">
          <Label>Table / view</Label>
          <Select value={table} onChange={(e) => setTable(e.target.value)}>
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <PrivGrid
        rows={rows}
        privs={[
          { key: "select", priv: "SELECT", label: "Select" },
          { key: "insert", priv: "INSERT", label: "Insert" },
          { key: "update", priv: "UPDATE", label: "Update" },
          { key: "delete", priv: "DELETE", label: "Delete" },
          { key: "truncate", priv: "TRUNCATE", label: "Truncate" },
          { key: "references", priv: "REFERENCES", label: "Refs" },
          { key: "trigger", priv: "TRIGGER", label: "Trigger" },
        ]}
        onToggle={toggle}
      />
    </div>
  );
}

/* ---------------- Extensions ---------------- */

interface ExtensionInfo {
  name: string;
  installedVersion: string | null;
  defaultVersion: string | null;
  comment: string | null;
}

function Extensions({
  database,
  notify,
}: {
  database: string;
  notify: Notify;
}) {
  const [exts, setExts] = useState<ExtensionInfo[]>([]);
  const [filter, setFilter] = useState("");

  const load = useCallback(() => {
    if (!database) return;
    fetch(`/api/extensions?database=${encodeURIComponent(database)}`)
      .then((r) => r.json())
      .then((d) => setExts(d.extensions || []))
      .catch((e) => notify((e as Error).message, "error"));
  }, [database, notify]);
  useEffect(() => load(), [load]);

  async function change(name: string, install: boolean) {
    const res = await fetch("/api/extensions", {
      method: install ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database, name }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Failed", "error");
    notify(`${install ? "Installed" : "Dropped"} extension ${name}`, "success");
    load();
  }

  const visible = exts.filter((e) =>
    e.name.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-3">
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter extensions…"
        className="h-9 w-64 rounded-md border border-border bg-background px-3 text-sm focus:border-primary focus:outline-none"
      />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Extension</th>
              <th className="px-4 py-2.5 font-medium">Installed</th>
              <th className="px-4 py-2.5 font-medium">Available</th>
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((e) => (
              <tr
                key={e.name}
                className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
              >
                <td className="px-4 py-2 font-mono">
                  <span className="inline-flex items-center gap-2">
                    <Puzzle size={13} className="text-primary" />
                    {e.name}
                  </span>
                </td>
                <td className="px-4 py-2">
                  {e.installedVersion ? (
                    <Badge tone="success">{e.installedVersion}</Badge>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-muted">{e.defaultVersion}</td>
                <td className="max-w-md truncate px-4 py-2 text-xs text-muted">
                  {e.comment}
                </td>
                <td className="px-4 py-2 text-right">
                  {e.installedVersion ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted hover:text-danger"
                      onClick={() => change(e.name, false)}
                    >
                      <Trash2 size={13} /> Drop
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => change(e.name, true)}
                    >
                      <Plus size={13} /> Install
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
