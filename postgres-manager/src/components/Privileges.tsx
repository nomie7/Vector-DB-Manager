"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, Select, Label, Toggle } from "@/components/ui";
import { DatabaseInfo, DatabasePrivilegeRow, Notify } from "@/lib/types";
import { ShieldCheck } from "lucide-react";

const PRIVS: { key: keyof DatabasePrivilegeRow; priv: string; label: string }[] =
  [
    { key: "connect", priv: "CONNECT", label: "Connect" },
    { key: "create", priv: "CREATE", label: "Create" },
    { key: "temporary", priv: "TEMPORARY", label: "Temp" },
  ];

export default function Privileges({ notify }: { notify: Notify }) {
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<DatabasePrivilegeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((data) => {
        const dbs: DatabaseInfo[] = (data.databases || []).filter(
          (d: DatabaseInfo) => !d.isTemplate
        );
        setDatabases(dbs);
        if (dbs.length) setSelected(dbs[0].name);
      })
      .catch((e) => notify((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPrivs = useCallback(
    async (db: string) => {
      if (!db) return;
      setLoading(true);
      try {
        const res = await fetch(
          `/api/privileges?database=${encodeURIComponent(db)}`
        ).then((r) => r.json());
        if (res.error) throw new Error(res.error);
        setRows(res.privileges || []);
      } catch (e) {
        notify((e as Error).message, "error");
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  useEffect(() => {
    if (selected) loadPrivs(selected);
  }, [selected, loadPrivs]);

  async function change(
    role: string,
    privilege: string,
    grant: boolean
  ) {
    const res = await fetch("/api/privileges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ database: selected, role, privilege, grant }),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to change privilege", "error");
    notify(
      `${grant ? "Granted" : "Revoked"} ${privilege} ${
        grant ? "to" : "from"
      } ${role}`,
      "success"
    );
    loadPrivs(selected);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Database privileges</h2>
          <p className="text-xs text-muted">
            Grant or revoke database-level privileges per role.
          </p>
        </div>
        <div className="w-56">
          <Label>Database</Label>
          <Select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {databases.map((d) => (
              <option key={d.name} value={d.name}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Role</th>
              {PRIVS.map((p) => (
                <th key={p.priv} className="px-4 py-2.5 text-center font-medium">
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
                <td className="px-4 py-2.5 font-mono text-xs">{row.role}</td>
                {PRIVS.map((p) => (
                  <td key={p.priv} className="px-4 py-2.5">
                    <div className="flex justify-center">
                      <Toggle
                        checked={Boolean(row[p.key])}
                        onChange={(v) => change(row.role, p.priv, v)}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={PRIVS.length + 1}
                  className="px-4 py-8 text-center text-muted"
                >
                  <ShieldCheck className="mx-auto mb-2 opacity-40" />
                  Select a database to view privileges.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-muted">
        Note: superusers implicitly hold all privileges, so their toggles always
        appear enabled. PUBLIC grants may also apply to every role.
      </p>
    </div>
  );
}
