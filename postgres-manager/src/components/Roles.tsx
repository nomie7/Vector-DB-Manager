"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Label,
  Modal,
  Badge,
  Toggle,
} from "@/components/ui";
import { RoleInfo, Notify } from "@/lib/types";
import {
  Plus,
  Trash2,
  RefreshCw,
  KeyRound,
  User,
  Copy,
  Wand2,
  Check,
} from "lucide-react";

const ATTRS = [
  { key: "canLogin", label: "Login", patch: "login" },
  { key: "superuser", label: "Superuser", patch: "superuser" },
  { key: "createDb", label: "Create DB", patch: "createDb" },
  { key: "createRole", label: "Create Role", patch: "createRole" },
  { key: "replication", label: "Replication", patch: "replication" },
] as const;

export default function Roles({ notify }: { notify: Notify }) {
  const [roles, setRoles] = useState<RoleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [dropTarget, setDropTarget] = useState<RoleInfo | null>(null);
  const [pwTarget, setPwTarget] = useState<RoleInfo | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/roles").then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setRoles(res.roles || []);
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

  async function toggleAttr(role: RoleInfo, patchKey: string, value: boolean) {
    const res = await fetch(`/api/roles/${encodeURIComponent(role.name)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [patchKey]: value }),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to update role", "error");
    notify(`Updated ${role.name}`, "success");
    load();
  }

  async function drop() {
    if (!dropTarget) return;
    const res = await fetch(`/api/roles/${encodeURIComponent(dropTarget.name)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to drop role", "error");
    notify(`Role "${dropTarget.name}" dropped`, "success");
    setDropTarget(null);
    load();
  }

  const visible = roles.filter((r) => !r.name.startsWith("pg_"));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Roles &amp; Users</h2>
          <p className="text-xs text-muted">{visible.length} roles</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New role
          </Button>
        </div>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Attributes</th>
              <th className="px-4 py-2.5 font-medium">Member of</th>
              <th className="px-4 py-2.5 font-medium">Conn limit</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((role) => (
              <tr
                key={role.name}
                className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
              >
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <User size={14} className="text-primary" />
                    {role.name}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {role.superuser && <Badge tone="primary">superuser</Badge>}
                    {role.canLogin ? (
                      <Badge tone="success">login</Badge>
                    ) : (
                      <Badge>no-login</Badge>
                    )}
                    {role.createDb && <Badge>createdb</Badge>}
                    {role.createRole && <Badge>createrole</Badge>}
                    {role.replication && <Badge>replication</Badge>}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted">
                  {role.memberOf.length ? role.memberOf.join(", ") : "—"}
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {role.connectionLimit === -1 ? "∞" : role.connectionLimit}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Set / rotate password"
                      onClick={() => setPwTarget(role)}
                    >
                      <KeyRound size={15} />
                    </Button>
                    {!role.superuser && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Drop role"
                        className="text-muted hover:text-danger"
                        onClick={() => setDropTarget(role)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Quick attribute editing panel */}
      {visible.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Quick attribute toggles</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="px-2 py-1 text-left font-medium">Role</th>
                  {ATTRS.map((a) => (
                    <th key={a.key} className="px-2 py-1 text-center font-medium">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((role) => (
                  <tr key={role.name} className="border-t border-border/50">
                    <td className="px-2 py-1.5 font-mono">{role.name}</td>
                    {ATTRS.map((a) => (
                      <td key={a.key} className="px-2 py-1.5 text-center">
                        <div className="flex justify-center">
                          <Toggle
                            checked={role[a.key] as boolean}
                            onChange={(v) => toggleAttr(role, a.patch, v)}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCreate && (
        <CreateRoleModal
          notify={notify}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {pwTarget && (
        <PasswordModal
          role={pwTarget}
          notify={notify}
          onClose={() => setPwTarget(null)}
        />
      )}

      <Modal
        open={!!dropTarget}
        onClose={() => setDropTarget(null)}
        title="Drop role"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDropTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={drop}>
              Drop role
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Drop role <span className="font-semibold">{dropTarget?.name}</span>?
          This fails if the role still owns objects or has granted privileges.
        </p>
      </Modal>
    </div>
  );
}

/* ---------------- Create role modal ---------------- */

function CreateRoleModal({
  notify,
  onClose,
  onCreated,
}: {
  notify: Notify;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    password: "",
    login: true,
    superuser: false,
    createDb: false,
    createRole: false,
    replication: false,
  });

  async function generate() {
    const res = await fetch("/api/generate-password").then((r) => r.json());
    setForm((f) => ({ ...f, password: res.password }));
  }

  async function submit() {
    if (!form.name.trim()) return notify("Role name is required", "error");
    const res = await fetch("/api/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to create role", "error");
    notify(`Role "${form.name}" created`, "success");
    onCreated();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Create role"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label>Role name</Label>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="app_user"
          />
        </div>
        <div>
          <Label>Password (optional)</Label>
          <div className="flex gap-2">
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="leave blank for no password"
              className="font-mono"
            />
            <Button variant="secondary" onClick={generate} title="Generate">
              <Wand2 size={15} />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          {[
            ["login", "Can login"],
            ["superuser", "Superuser"],
            ["createDb", "Create databases"],
            ["createRole", "Create roles"],
            ["replication", "Replication"],
          ].map(([key, label]) => (
            <Toggle
              key={key}
              label={label}
              checked={form[key as keyof typeof form] as boolean}
              onChange={(v) => setForm({ ...form, [key]: v })}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Password rotation modal ---------------- */

function PasswordModal({
  role,
  notify,
  onClose,
}: {
  role: RoleInfo;
  notify: Notify;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    const res = await fetch("/api/generate-password?length=24").then((r) =>
      r.json()
    );
    setPassword(res.password);
  }

  async function submit(useGenerated: boolean) {
    const body: Record<string, unknown> = {};
    if (!useGenerated) body.password = password;
    if (validUntil) body.validUntil = validUntil;

    const res = await fetch(
      `/api/roles/${encodeURIComponent(role.name)}/password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Failed to set password", "error");

    if (data.password) {
      setResult(data.password);
      notify(`Generated a new password for ${role.name}`, "success");
    } else {
      notify(`Password updated for ${role.name}`, "success");
      onClose();
    }
  }

  function copy() {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Set password — ${role.name}`}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => submit(true)}
              title="Generate a strong password and apply it"
            >
              <Wand2 size={15} /> Rotate (auto)
            </Button>
            <Button
              variant="primary"
              onClick={() => submit(false)}
              disabled={!password}
            >
              Set password
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <p className="text-sm text-success">
            New password generated. Copy it now — it won&apos;t be shown again.
          </p>
          <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2">
            <code className="flex-1 break-all font-mono text-sm">{result}</code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label>New password</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="enter a password, or use Rotate (auto)"
                className="font-mono"
              />
              <Button variant="secondary" onClick={generate} title="Generate">
                <Wand2 size={15} />
              </Button>
            </div>
          </div>
          <div>
            <Label>Expire password on (optional)</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
