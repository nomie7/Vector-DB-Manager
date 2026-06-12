"use client";

import { Card, Badge } from "@/components/ui";
import { StatusInfo } from "@/lib/types";
import {
  Database,
  Users,
  Activity,
  Server,
  ShieldCheck,
  Clock,
} from "lucide-react";

function Stat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted">{label}</div>
          <div className="truncate text-lg font-semibold">{value}</div>
          {sub && <div className="text-xs text-muted">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

export default function Overview({ status }: { status: StatusInfo | null }) {
  if (!status) {
    return <div className="text-sm text-muted">Loading…</div>;
  }

  if (!status.connected) {
    return (
      <Card className="border-danger/40 p-6">
        <h3 className="mb-1 flex items-center gap-2 font-semibold text-danger">
          <Server size={18} /> Not connected
        </h3>
        <p className="text-sm text-muted">
          Could not connect to PostgreSQL. Check your connection settings in{" "}
          <code className="rounded bg-surface-2 px-1">.env.local</code> and that
          the server is running.
        </p>
        {status.error && (
          <pre className="mt-3 overflow-x-auto rounded-md bg-background p-3 text-xs text-danger">
            {status.error}
          </pre>
        )}
      </Card>
    );
  }

  const serverVersion =
    status.serverVersion || status.version?.split(" ")[1] || "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Server size={20} />}
          label="PostgreSQL"
          value={`v${serverVersion}`}
        />
        <Stat
          icon={<Database size={20} />}
          label="Databases"
          value={status.databaseCount ?? "—"}
        />
        <Stat
          icon={<Users size={20} />}
          label="Roles"
          value={status.roleCount ?? "—"}
        />
        <Stat
          icon={<Activity size={20} />}
          label="Connections"
          value={`${status.connections?.active ?? 0} active`}
          sub={`${status.connections?.total ?? 0} of ${
            status.connections?.max ?? 0
          } used`}
        />
      </div>

      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Server details</h3>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <Row label="Connected as">
            <span className="font-mono">{status.currentUser}</span>
            {status.isSuperuser ? (
              <Badge tone="primary" className="ml-2">
                <ShieldCheck size={11} className="mr-1" /> superuser
              </Badge>
            ) : (
              <Badge tone="warning" className="ml-2">
                limited
              </Badge>
            )}
          </Row>
          <Row label="Uptime">
            <span className="inline-flex items-center gap-1">
              <Clock size={13} className="text-muted" />
              {status.uptime?.split(".")[0]}
            </span>
          </Row>
          <Row label="Started">{formatTime(status.startTime)}</Row>
          <Row label="Full version">
            <span className="text-xs text-muted">{status.version}</span>
          </Row>
        </dl>
        {!status.isSuperuser && (
          <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
            You are not connected as a superuser. Some operations (creating
            databases, managing other roles) may be restricted.
          </p>
        )}
      </Card>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 pb-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="flex items-center">{children}</dd>
    </div>
  );
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
