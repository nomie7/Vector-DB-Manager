"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Badge, Toggle } from "@/components/ui";
import { Notify } from "@/lib/types";
import { RefreshCw, Ban, XCircle, Activity } from "lucide-react";

interface ActivityRow {
  pid: number;
  user: string | null;
  database: string | null;
  clientAddr: string | null;
  applicationName: string | null;
  state: string | null;
  waitEvent: string | null;
  queryStart: string | null;
  durationSeconds: number | null;
  query: string | null;
  isCurrent: boolean;
}

export default function Sessions({ notify }: { notify: Notify }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [auto, setAuto] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/activity").then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setRows(res.activity || []);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [auto, load]);

  async function act(pid: number, action: "cancel" | "terminate") {
    const res = await fetch("/api/activity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pid, action }),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Action failed", "error");
    notify(
      data.applied
        ? `${action === "cancel" ? "Cancelled query" : "Terminated"} on pid ${pid}`
        : `Signal sent to ${pid} (no effect — backend may have ended)`,
      data.applied ? "success" : "info"
    );
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Active sessions</h2>
          <p className="text-xs text-muted">
            {rows.length} client backend{rows.length === 1 ? "" : "s"} connected
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Toggle checked={auto} onChange={setAuto} label="Auto-refresh" />
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-3 py-2.5 font-medium">PID</th>
              <th className="px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Database</th>
              <th className="px-3 py-2.5 font-medium">State</th>
              <th className="px-3 py-2.5 font-medium">Duration</th>
              <th className="px-3 py-2.5 font-medium">Query</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.pid}
                className="border-b border-border/50 align-top last:border-0 hover:bg-surface-2/40"
              >
                <td className="px-3 py-2.5 font-mono">
                  {r.pid}
                  {r.isCurrent && (
                    <Badge tone="primary" className="ml-1">
                      me
                    </Badge>
                  )}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs">{r.user || "—"}</td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {r.database || "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={stateTone(r.state)}>{r.state || "—"}</Badge>
                  {r.waitEvent && (
                    <div className="mt-0.5 text-[10px] text-muted">
                      wait: {r.waitEvent}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted">
                  {formatDuration(r.durationSeconds)}
                </td>
                <td className="max-w-md px-3 py-2.5">
                  <code className="block max-h-16 overflow-y-auto whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">
                    {r.query || "—"}
                  </code>
                </td>
                <td className="px-3 py-2.5">
                  {!r.isCurrent && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Cancel running query"
                        onClick={() => act(r.pid, "cancel")}
                      >
                        <Ban size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Terminate backend"
                        className="text-muted hover:text-danger"
                        onClick={() => act(r.pid, "terminate")}
                      >
                        <XCircle size={15} />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  <Activity className="mx-auto mb-2 opacity-40" />
                  No active client sessions.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function stateTone(state: string | null) {
  if (state === "active") return "success" as const;
  if (state === "idle in transaction") return "warning" as const;
  if (state === "idle") return "default" as const;
  return "default" as const;
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return "—";
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}
