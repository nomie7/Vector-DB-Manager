"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Database,
  Users,
  ShieldCheck,
  Terminal,
  Table2,
  Activity,
  Save,
  CircleDot,
  X,
} from "lucide-react";
import Overview from "@/components/Overview";
import Databases from "@/components/Databases";
import Roles from "@/components/Roles";
import Permissions from "@/components/Permissions";
import Tables from "@/components/Tables";
import Sessions from "@/components/Sessions";
import Backup from "@/components/Backup";
import SqlConsole from "@/components/SqlConsole";
import { cn } from "@/lib/utils";
import { StatusInfo, Notify } from "@/lib/types";

type TabId =
  | "overview"
  | "databases"
  | "roles"
  | "permissions"
  | "tables"
  | "sessions"
  | "backup"
  | "sql";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
  { id: "databases", label: "Databases", icon: <Database size={16} /> },
  { id: "roles", label: "Roles & Users", icon: <Users size={16} /> },
  { id: "permissions", label: "Permissions", icon: <ShieldCheck size={16} /> },
  { id: "tables", label: "Tables", icon: <Table2 size={16} /> },
  { id: "sessions", label: "Sessions", icon: <Activity size={16} /> },
  { id: "backup", label: "Backup", icon: <Save size={16} /> },
  { id: "sql", label: "SQL Console", icon: <Terminal size={16} /> },
];

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export default function Home() {
  const [tab, setTab] = useState<TabId>("overview");
  const [status, setStatus] = useState<StatusInfo | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify: Notify = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status").then((r) => r.json());
      setStatus(res);
    } catch {
      setStatus({ connected: false, error: "Failed to reach the server" });
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Database size={18} />
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">
                Postgres Manager
              </h1>
              <p className="text-[11px] text-muted">Local administration GUI</p>
            </div>
          </div>
          <ConnectionPill status={status} onClick={loadStatus} />
        </div>
        {/* Tabs */}
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted hover:text-foreground"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "overview" && <Overview status={status} />}
        {tab === "databases" && <Databases notify={notify} />}
        {tab === "roles" && <Roles notify={notify} />}
        {tab === "permissions" && <Permissions notify={notify} />}
        {tab === "tables" && <Tables notify={notify} />}
        {tab === "sessions" && <Sessions notify={notify} />}
        {tab === "backup" && <Backup notify={notify} />}
        {tab === "sql" && <SqlConsole notify={notify} />}
      </main>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg",
              t.type === "success" &&
                "border-success/40 bg-surface text-success",
              t.type === "error" && "border-danger/40 bg-surface text-danger",
              t.type === "info" && "border-border bg-surface text-foreground"
            )}
          >
            <span className="break-words">{t.message}</span>
            <button
              onClick={() =>
                setToasts((list) => list.filter((x) => x.id !== t.id))
              }
              className="text-muted hover:text-foreground"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectionPill({
  status,
  onClick,
}: {
  status: StatusInfo | null;
  onClick: () => void;
}) {
  const connected = status?.connected;
  return (
    <button
      onClick={onClick}
      title="Click to refresh connection"
      className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs"
    >
      <CircleDot
        size={12}
        className={connected ? "text-success" : "text-danger"}
      />
      {connected ? (
        <span className="text-muted">
          {status?.currentUser}
          {status?.serverVersion ? ` · pg ${status.serverVersion}` : ""}
        </span>
      ) : (
        <span className="text-danger">Disconnected</span>
      )}
    </button>
  );
}
