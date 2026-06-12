"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Select, Label } from "@/components/ui";
import { DatabaseInfo, Notify } from "@/lib/types";
import { Download, Upload, Loader2, FileDown, FileUp } from "lucide-react";

export default function Backup({ notify }: { notify: Notify }) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [dumpDb, setDumpDb] = useState("");
  const [dumpFormat, setDumpFormat] = useState<"plain" | "custom">("plain");
  const [dumping, setDumping] = useState(false);

  const [restoreDb, setRestoreDb] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreOutput, setRestoreOutput] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((data) => {
        const names = (data.databases || [])
          .filter((d: DatabaseInfo) => d.allowConnections && !d.isTemplate)
          .map((d: DatabaseInfo) => d.name);
        setDatabases(names);
        if (names.length) {
          setDumpDb(names[0]);
          setRestoreDb(names[0]);
        }
      })
      .catch((e) => notify((e as Error).message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function downloadBackup() {
    if (!dumpDb) return;
    setDumping(true);
    try {
      const res = await fetch(
        `/api/backup?database=${encodeURIComponent(dumpDb)}&format=${dumpFormat}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Backup failed (${res.status})`);
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename =
        match?.[1] ||
        `${dumpDb}.${dumpFormat === "custom" ? "dump" : "sql"}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      notify(`Backup of "${dumpDb}" downloaded`, "success");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setDumping(false);
    }
  }

  async function uploadRestore() {
    const file = fileRef.current?.files?.[0];
    if (!file) return notify("Choose a dump file first", "error");
    if (!restoreDb) return notify("Choose a target database", "error");
    setRestoring(true);
    setRestoreOutput(null);
    try {
      const form = new FormData();
      form.append("database", restoreDb);
      form.append("file", file);
      const res = await fetch("/api/restore", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore failed");
      setRestoreOutput(data.output || "Restore completed.");
      notify(`Restored into "${restoreDb}"`, "success");
    } catch (e) {
      setRestoreOutput((e as Error).message);
      notify((e as Error).message, "error");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Backup &amp; restore</h2>
        <p className="text-xs text-muted">
          Uses the server&apos;s <code>pg_dump</code> / <code>pg_restore</code>{" "}
          binaries.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Backup */}
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileDown size={16} className="text-primary" /> Backup a database
          </h3>
          <div className="space-y-3">
            <div>
              <Label>Database</Label>
              <Select value={dumpDb} onChange={(e) => setDumpDb(e.target.value)}>
                {databases.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select
                value={dumpFormat}
                onChange={(e) =>
                  setDumpFormat(e.target.value as "plain" | "custom")
                }
              >
                <option value="plain">Plain SQL (.sql)</option>
                <option value="custom">Custom / compressed (.dump)</option>
              </Select>
            </div>
            <Button
              variant="primary"
              onClick={downloadBackup}
              disabled={dumping || !dumpDb}
              className="w-full"
            >
              {dumping ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              Download backup
            </Button>
          </div>
        </Card>

        {/* Restore */}
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <FileUp size={16} className="text-primary" /> Restore a dump
          </h3>
          <div className="space-y-3">
            <div>
              <Label>Target database</Label>
              <Select
                value={restoreDb}
                onChange={(e) => setRestoreDb(e.target.value)}
              >
                {databases.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Dump file (.sql or .dump)</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".sql,.dump,.backup,.tar,application/sql,application/octet-stream"
                className="block w-full text-xs text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface-2 file:px-3 file:py-1.5 file:text-foreground hover:file:bg-[#22304a]"
              />
            </div>
            <Button
              variant="primary"
              onClick={uploadRestore}
              disabled={restoring || !restoreDb}
              className="w-full"
            >
              {restoring ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Upload size={16} />
              )}
              Restore into database
            </Button>
            <p className="text-[11px] text-warning">
              Restoring can overwrite existing data. Make sure the target
              database is correct.
            </p>
          </div>
        </Card>
      </div>

      {restoreOutput && (
        <Card className="p-4">
          <h4 className="mb-2 text-xs font-semibold text-muted">Restore output</h4>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs text-foreground/80">
            {restoreOutput}
          </pre>
        </Card>
      )}
    </div>
  );
}
