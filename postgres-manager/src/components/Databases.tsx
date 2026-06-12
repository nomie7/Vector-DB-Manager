"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Modal,
  Badge,
  Select,
} from "@/components/ui";
import { DatabaseInfo, RoleInfo, Notify } from "@/lib/types";
import { Plus, Trash2, RefreshCw, Database as DbIcon } from "lucide-react";

export default function Databases({ notify }: { notify: Notify }) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dropTarget, setDropTarget] = useState<DatabaseInfo | null>(null);
  const [forceDrop, setForceDrop] = useState(false);

  const [form, setForm] = useState({ name: "", owner: "", encoding: "UTF8" });

  async function load() {
    setLoading(true);
    try {
      const [dbRes, roleRes] = await Promise.all([
        fetch("/api/databases").then((r) => r.json()),
        fetch("/api/roles").then((r) => r.json()),
      ]);
      if (dbRes.error) throw new Error(dbRes.error);
      setDatabases(dbRes.databases || []);
      setRoles(roleRes.roles || []);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    if (!form.name.trim()) return notify("Database name is required", "error");
    const res = await fetch("/api/databases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to create database", "error");
    notify(`Database "${form.name}" created`, "success");
    setShowCreate(false);
    setForm({ name: "", owner: "", encoding: "UTF8" });
    load();
  }

  async function drop() {
    if (!dropTarget) return;
    const res = await fetch(
      `/api/databases/${encodeURIComponent(dropTarget.name)}?force=${forceDrop}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to drop database", "error");
    notify(`Database "${dropTarget.name}" dropped`, "success");
    setDropTarget(null);
    setForceDrop(false);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Databases</h2>
          <p className="text-xs text-muted">
            {databases.length} database{databases.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New database
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Owner</th>
              <th className="px-4 py-2.5 font-medium">Encoding</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="px-4 py-2.5 font-medium">Conns</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {databases.map((db) => (
              <tr
                key={db.name}
                className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <DbIcon size={14} className="text-primary" />
                    {db.name}
                    {db.isTemplate && <Badge>template</Badge>}
                    {!db.allowConnections && (
                      <Badge tone="warning">no-connect</Badge>
                    )}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-muted">
                  {db.owner}
                </td>
                <td className="px-4 py-2.5 text-muted">{db.encoding}</td>
                <td className="px-4 py-2.5 text-muted">{db.size}</td>
                <td className="px-4 py-2.5 text-muted">{db.connections}</td>
                <td className="px-4 py-2.5 text-right">
                  {!db.isTemplate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDropTarget(db)}
                      title="Drop database"
                      className="text-muted hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {databases.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No databases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Create modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create database"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={create}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="my_database"
            />
          </div>
          <div>
            <Label>Owner</Label>
            <Select
              value={form.owner}
              onChange={(e) => setForm({ ...form, owner: e.target.value })}
            >
              <option value="">(default — current user)</option>
              {roles
                .filter((r) => !r.name.startsWith("pg_"))
                .map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label>Encoding</Label>
            <Select
              value={form.encoding}
              onChange={(e) => setForm({ ...form, encoding: e.target.value })}
            >
              {["UTF8", "LATIN1", "SQL_ASCII", "WIN1252"].map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Modal>

      {/* Drop confirmation */}
      <Modal
        open={!!dropTarget}
        onClose={() => {
          setDropTarget(null);
          setForceDrop(false);
        }}
        title="Drop database"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setDropTarget(null);
                setForceDrop(false);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={drop}>
              Drop permanently
            </Button>
          </>
        }
      >
        <p className="text-sm">
          This will permanently delete{" "}
          <span className="font-semibold">{dropTarget?.name}</span> and all of
          its data. This cannot be undone.
        </p>
        {!!dropTarget?.connections && dropTarget.connections > 0 && (
          <label className="mt-4 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            <input
              type="checkbox"
              checked={forceDrop}
              onChange={(e) => setForceDrop(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              This database has {dropTarget.connections} active connection
              {dropTarget.connections === 1 ? "" : "s"}. Force-terminate them
              before dropping (PostgreSQL 13+).
            </span>
          </label>
        )}
      </Modal>
    </div>
  );
}
