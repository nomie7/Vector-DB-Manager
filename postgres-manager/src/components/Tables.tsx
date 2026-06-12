"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Select,
  Label,
  Badge,
  Modal,
  Input,
} from "@/components/ui";
import { DatabaseInfo, Notify } from "@/lib/types";
import {
  Table2,
  Eye,
  Columns3,
  KeyRound,
  RefreshCw,
  Plus,
  Trash2,
  Pencil,
  Download,
  ChevronLeft,
  ChevronRight,
  Database as DbIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TableInfo {
  schema: string;
  name: string;
  type: "table" | "view" | "matview" | "partitioned" | "foreign";
  owner: string;
  rowEstimate: number;
  size: string;
}
interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  isPrimaryKey: boolean;
}
interface IndexInfo {
  name: string;
  definition: string;
  primary: boolean;
  unique: boolean;
}
interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
  primaryKey: string[];
  rowEstimate: number;
}

const PAGE_SIZE = 50;

export default function Tables({ notify }: { notify: Notify }) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [database, setDatabase] = useState("");
  const [schemas, setSchemas] = useState<{ name: string; isSystem: boolean }[]>([]);
  const [schema, setSchema] = useState("");
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selected, setSelected] = useState<TableInfo | null>(null);

  const [view, setView] = useState<"data" | "columns" | "indexes">("data");
  const [details, setDetails] = useState<{
    columns: ColumnInfo[];
    indexes: IndexInfo[];
    primaryKey: string[];
  } | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [page, setPage] = useState(0);
  const [order, setOrder] = useState<{ by: string; dir: "ASC" | "DESC" } | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [editMode, setEditMode] = useState<"edit" | "insert">("edit");
  const [confirmAction, setConfirmAction] = useState<"truncate" | "drop" | null>(
    null
  );

  /* ---- loaders ---- */

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((d) => {
        const names = (d.databases || [])
          .filter((x: DatabaseInfo) => x.allowConnections && !x.isTemplate)
          .map((x: DatabaseInfo) => x.name);
        setDatabases(names);
        if (names.includes("postgres")) setDatabase("postgres");
        else if (names.length) setDatabase(names[0]);
      })
      .catch((e) => notify((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!database) return;
    setSelected(null);
    setData(null);
    setDetails(null);
    fetch(`/api/schemas?database=${encodeURIComponent(database)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.schemas || [];
        setSchemas(list);
        const preferred =
          list.find((s: { name: string }) => s.name === "public")?.name ||
          list.find((s: { isSystem: boolean }) => !s.isSystem)?.name ||
          list[0]?.name ||
          "";
        setSchema(preferred);
      })
      .catch((e) => notify((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database]);

  const loadTables = useCallback(() => {
    if (!database || !schema) return;
    fetch(
      `/api/tables?database=${encodeURIComponent(
        database
      )}&schema=${encodeURIComponent(schema)}`
    )
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []))
      .catch((e) => notify((e as Error).message, "error"));
  }, [database, schema, notify]);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  const loadDetails = useCallback(
    (t: TableInfo) => {
      fetch(
        `/api/tables/details?database=${encodeURIComponent(
          database
        )}&schema=${encodeURIComponent(t.schema)}&table=${encodeURIComponent(
          t.name
        )}`
      )
        .then((r) => r.json())
        .then((d) => setDetails(d))
        .catch((e) => notify((e as Error).message, "error"));
    },
    [database, notify]
  );

  const loadData = useCallback(
    (t: TableInfo, p: number, ord: typeof order) => {
      setLoading(true);
      const params = new URLSearchParams({
        database,
        schema: t.schema,
        table: t.name,
        limit: String(PAGE_SIZE),
        offset: String(p * PAGE_SIZE),
      });
      if (ord) {
        params.set("orderBy", ord.by);
        params.set("orderDir", ord.dir);
      }
      fetch(`/api/tables/data?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.error) throw new Error(d.error);
          setData(d);
        })
        .catch((e) => notify((e as Error).message, "error"))
        .finally(() => setLoading(false));
    },
    [database, notify]
  );

  function selectTable(t: TableInfo) {
    setSelected(t);
    setView("data");
    setPage(0);
    setOrder(null);
    loadDetails(t);
    loadData(t, 0, null);
  }

  function refresh() {
    if (selected) {
      loadDetails(selected);
      loadData(selected, page, order);
    }
    loadTables();
  }

  function sortBy(col: string) {
    if (!selected) return;
    const dir: "ASC" | "DESC" =
      order?.by === col && order.dir === "ASC" ? "DESC" : "ASC";
    const ord = { by: col, dir };
    setOrder(ord);
    setPage(0);
    loadData(selected, 0, ord);
  }

  function changePage(delta: number) {
    if (!selected) return;
    const next = Math.max(0, page + delta);
    setPage(next);
    loadData(selected, next, order);
  }

  /* ---- row mutations ---- */

  async function saveRow(values: Record<string, unknown>, original: Record<string, unknown> | null) {
    if (!selected) return;
    const isInsert = editMode === "insert";
    const pk =
      original && data
        ? Object.fromEntries(data.primaryKey.map((k) => [k, original[k]]))
        : null;

    const res = await fetch("/api/tables/rows", {
      method: isInsert ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database,
        schema: selected.schema,
        table: selected.name,
        pk,
        values,
      }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Save failed", "error");
    notify(isInsert ? "Row inserted" : "Row updated", "success");
    setEditRow(null);
    loadData(selected, page, order);
  }

  async function deleteRow(row: Record<string, unknown>) {
    if (!selected || !data) return;
    const pk = Object.fromEntries(data.primaryKey.map((k) => [k, row[k]]));
    const res = await fetch("/api/tables/rows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database,
        schema: selected.schema,
        table: selected.name,
        pk,
      }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Delete failed", "error");
    notify("Row deleted", "success");
    loadData(selected, page, order);
  }

  async function runTableAction() {
    if (!selected || !confirmAction) return;
    const res = await fetch("/api/tables/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database,
        schema: selected.schema,
        table: selected.name,
        kind: selected.type,
        action: confirmAction,
      }),
    });
    const d = await res.json();
    if (!res.ok) return notify(d.error || "Action failed", "error");
    notify(
      confirmAction === "drop"
        ? `Dropped ${selected.name}`
        : `Truncated ${selected.name}`,
      "success"
    );
    const wasDrop = confirmAction === "drop";
    setConfirmAction(null);
    if (wasDrop) {
      setSelected(null);
      setData(null);
      loadTables();
    } else {
      loadData(selected, 0, order);
      setPage(0);
    }
  }

  function exportCsv() {
    if (!data) return;
    const esc = (v: unknown) => {
      if (v === null || v === undefined) return "";
      const s = typeof v === "object" ? JSON.stringify(v) : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      data.columns.join(","),
      ...data.rows.map((r) => data.columns.map((c) => esc(r[c])).join(",")),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected?.name}-page${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const editable = selected?.type === "table" && (data?.primaryKey.length ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* selectors */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Database</Label>
          <Select value={database} onChange={(e) => setDatabase(e.target.value)}>
            {databases.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-48">
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
        <Button variant="ghost" size="icon" onClick={refresh} title="Refresh">
          <RefreshCw size={16} />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* table list */}
        <Card className="h-fit overflow-hidden">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted">
            {tables.length} object{tables.length === 1 ? "" : "s"}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {tables.map((t) => (
              <button
                key={`${t.schema}.${t.name}`}
                onClick={() => selectTable(t)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2/60",
                  selected?.name === t.name &&
                    selected?.schema === t.schema &&
                    "bg-surface-2"
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {t.type === "table" ? (
                    <Table2 size={14} className="shrink-0 text-primary" />
                  ) : (
                    <Eye size={14} className="shrink-0 text-warning" />
                  )}
                  <span className="truncate">{t.name}</span>
                </span>
                {t.type !== "table" && <Badge>{t.type}</Badge>}
              </button>
            ))}
            {tables.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted">
                No tables in this schema.
              </div>
            )}
          </div>
        </Card>

        {/* table detail */}
        {!selected ? (
          <Card className="flex items-center justify-center p-12 text-sm text-muted">
            <div className="text-center">
              <DbIcon className="mx-auto mb-2 opacity-40" />
              Select a table to browse its data and structure.
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  {selected.schema}.{selected.name}
                  <Badge>{selected.type}</Badge>
                </h2>
                <p className="text-xs text-muted">
                  ~{selected.rowEstimate.toLocaleString()} rows · {selected.size}{" "}
                  · owner {selected.owner}
                </p>
              </div>
              <div className="flex gap-2">
                {selected.type === "table" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmAction("truncate")}
                    >
                      Truncate
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted hover:text-danger"
                  onClick={() => setConfirmAction("drop")}
                >
                  <Trash2 size={14} /> Drop
                </Button>
              </div>
            </div>

            {/* sub-tabs */}
            <div className="flex gap-1 border-b border-border">
              {(
                [
                  ["data", "Data", <Eye key="d" size={14} />],
                  ["columns", "Columns", <Columns3 key="c" size={14} />],
                  ["indexes", "Indexes", <KeyRound key="i" size={14} />],
                ] as const
              ).map(([id, label, icon]) => (
                <button
                  key={id}
                  onClick={() => setView(id)}
                  className={cn(
                    "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                    view === id
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted hover:text-foreground"
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {view === "data" && data && (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editable && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setEditMode("insert");
                          setEditRow({});
                        }}
                      >
                        <Plus size={14} /> Add row
                      </Button>
                    )}
                    <Button variant="secondary" size="sm" onClick={exportCsv}>
                      <Download size={14} /> CSV
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span>
                      rows {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + data.rows.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={page === 0}
                      onClick={() => changePage(-1)}
                    >
                      <ChevronLeft size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={data.rows.length < PAGE_SIZE}
                      onClick={() => changePage(1)}
                    >
                      <ChevronRight size={16} />
                    </Button>
                  </div>
                </div>

                <Card className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-surface">
                      <tr className="text-left text-muted">
                        {(editable || selected.type === "table") && (
                          <th className="w-16 px-2 py-2"></th>
                        )}
                        {data.columns.map((c) => (
                          <th
                            key={c}
                            onClick={() => sortBy(c)}
                            className="cursor-pointer whitespace-nowrap border-b border-border px-3 py-2 font-medium hover:text-foreground"
                          >
                            {c}
                            {order?.by === c && (
                              <span className="ml-1">
                                {order.dir === "ASC" ? "▲" : "▼"}
                              </span>
                            )}
                            {data.primaryKey.includes(c) && (
                              <KeyRound
                                size={10}
                                className="ml-1 inline text-warning"
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-border/40 hover:bg-surface-2/40"
                        >
                          {(editable || selected.type === "table") && (
                            <td className="px-2 py-1">
                              {editable && (
                                <div className="flex gap-0.5">
                                  <button
                                    title="Edit"
                                    onClick={() => {
                                      setEditMode("edit");
                                      setEditRow(row);
                                    }}
                                    className="text-muted hover:text-foreground"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    title="Delete"
                                    onClick={() => deleteRow(row)}
                                    className="text-muted hover:text-danger"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                          {data.columns.map((c) => (
                            <td
                              key={c}
                              className="max-w-xs truncate px-3 py-1.5 font-mono align-top"
                              title={formatCell(row[c])}
                            >
                              {formatCell(row[c])}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {data.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={data.columns.length + 1}
                            className="px-4 py-8 text-center text-muted"
                          >
                            No rows.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
                {!editable && selected.type === "table" && (
                  <p className="text-[11px] text-muted">
                    This table has no primary key, so inline editing is disabled.
                  </p>
                )}
                {loading && <p className="text-xs text-muted">Loading…</p>}
              </>
            )}

            {view === "columns" && details && (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">Column</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Nullable</th>
                      <th className="px-3 py-2 font-medium">Default</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.columns.map((c) => (
                      <tr key={c.name} className="border-b border-border/40">
                        <td className="px-3 py-1.5 font-mono">
                          {c.name}
                          {c.isPrimaryKey && (
                            <KeyRound
                              size={11}
                              className="ml-1 inline text-warning"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-primary">{c.type}</td>
                        <td className="px-3 py-1.5 text-muted">
                          {c.nullable ? "YES" : "NO"}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted">
                          {c.default ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {view === "indexes" && details && (
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Flags</th>
                      <th className="px-3 py-2 font-medium">Definition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.indexes.map((idx) => (
                      <tr key={idx.name} className="border-b border-border/40">
                        <td className="px-3 py-1.5 font-mono">{idx.name}</td>
                        <td className="px-3 py-1.5">
                          {idx.primary && <Badge tone="primary">PK</Badge>}{" "}
                          {idx.unique && !idx.primary && <Badge>unique</Badge>}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs text-muted">
                          {idx.definition}
                        </td>
                      </tr>
                    ))}
                    {details.indexes.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-4 py-6 text-center text-muted">
                          No indexes.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Row editor */}
      {editRow !== null && selected && details && (
        <RowEditor
          mode={editMode}
          columns={details.columns}
          original={editMode === "edit" ? editRow : null}
          onClose={() => setEditRow(null)}
          onSave={saveRow}
        />
      )}

      {/* Confirm truncate/drop */}
      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === "drop" ? "Drop object" : "Truncate table"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runTableAction}>
              {confirmAction === "drop" ? "Drop" : "Truncate"}
            </Button>
          </>
        }
      >
        <p className="text-sm">
          {confirmAction === "drop" ? (
            <>
              Permanently drop{" "}
              <span className="font-semibold">{selected?.name}</span> (with
              CASCADE)? This cannot be undone.
            </>
          ) : (
            <>
              Remove <span className="font-semibold">all rows</span> from{" "}
              {selected?.name}? This cannot be undone.
            </>
          )}
        </p>
      </Modal>
    </div>
  );
}

function RowEditor({
  mode,
  columns,
  original,
  onClose,
  onSave,
}: {
  mode: "edit" | "insert";
  columns: ColumnInfo[];
  original: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (
    values: Record<string, unknown>,
    original: Record<string, unknown> | null
  ) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const c of columns) {
      const v = original?.[c.name];
      init[c.name] = v === null || v === undefined ? "" : formatCell(v);
    }
    return init;
  });
  const [nulls, setNulls] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of columns) init[c.name] = original ? original[c.name] === null : false;
    return init;
  });

  function submit() {
    const out: Record<string, unknown> = {};
    for (const c of columns) {
      // On insert, skip untouched columns so DB defaults apply.
      if (mode === "insert" && values[c.name] === "" && !nulls[c.name]) continue;
      out[c.name] = nulls[c.name] ? null : values[c.name];
    }
    onSave(out, original);
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={mode === "insert" ? "Insert row" : "Edit row"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {mode === "insert" ? "Insert" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {columns.map((c) => (
          <div key={c.name} className="grid grid-cols-[160px_1fr_auto] items-center gap-3">
            <Label className="mb-0">
              {c.name}
              {c.isPrimaryKey && (
                <KeyRound size={10} className="ml-1 inline text-warning" />
              )}
              <span className="ml-1 block text-[10px] normal-case text-muted">
                {c.type}
              </span>
            </Label>
            <Input
              value={nulls[c.name] ? "" : values[c.name]}
              disabled={nulls[c.name]}
              placeholder={c.default ?? (c.nullable ? "NULL" : "")}
              onChange={(e) =>
                setValues({ ...values, [c.name]: e.target.value })
              }
              className="font-mono"
            />
            {c.nullable && (
              <label className="flex items-center gap-1 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={nulls[c.name]}
                  onChange={(e) =>
                    setNulls({ ...nulls, [c.name]: e.target.checked })
                  }
                />
                NULL
              </label>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function formatCell(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
