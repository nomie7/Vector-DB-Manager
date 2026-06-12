"use client";

import { useEffect, useState } from "react";
import { Button, Card, Select } from "@/components/ui";
import { DatabaseInfo, Notify } from "@/lib/types";
import { Play, Loader2 } from "lucide-react";

interface QueryResult {
  command?: string;
  rowCount?: number | null;
  fields: string[];
  rows: Record<string, unknown>[];
}

export default function SqlConsole({ notify }: { notify: Notify }) {
  const [databases, setDatabases] = useState<string[]>([]);
  const [database, setDatabase] = useState("");
  const [sql, setSql] = useState("SELECT version();");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/databases")
      .then((r) => r.json())
      .then((data) => {
        const names = (data.databases || [])
          .filter((d: DatabaseInfo) => d.allowConnections)
          .map((d: DatabaseInfo) => d.name);
        setDatabases(names);
        if (names.includes("postgres")) setDatabase("postgres");
        else if (names.length) setDatabase(names[0]);
      })
      .catch(() => {});
  }, []);

  async function run() {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, database }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Query failed");
        return;
      }
      setResult(data);
      notify(
        `${data.command || "OK"}${
          data.rowCount != null ? ` · ${data.rowCount} rows` : ""
        }`,
        "success"
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">SQL console</h2>
          <p className="text-xs text-muted">
            Run arbitrary SQL. Press{" "}
            <kbd className="rounded bg-surface-2 px-1">⌘/Ctrl</kbd>+
            <kbd className="rounded bg-surface-2 px-1">Enter</kbd> to execute.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-48">
            <Select
              value={database}
              onChange={(e) => setDatabase(e.target.value)}
            >
              {databases.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="primary" onClick={run} disabled={running}>
            {running ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            Run
          </Button>
        </div>
      </div>

      <Card className="p-0">
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          className="h-44 w-full resize-y rounded-xl bg-background p-4 font-mono text-sm text-foreground outline-none"
          placeholder="SELECT * FROM ..."
        />
      </Card>

      {error && (
        <Card className="border-danger/40 p-4">
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-danger">
            {error}
          </pre>
        </Card>
      )}

      {result && (
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
            <span>{result.command || "Result"}</span>
            <span>
              {result.rowCount != null ? `${result.rowCount} row(s)` : ""}
            </span>
          </div>
          {result.fields.length > 0 ? (
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface">
                  <tr className="text-left text-muted">
                    {result.fields.map((f) => (
                      <th
                        key={f}
                        className="border-b border-border px-3 py-2 font-medium"
                      >
                        {f}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      {result.fields.map((f) => (
                        <td
                          key={f}
                          className="px-3 py-1.5 font-mono align-top"
                        >
                          {formatCell(row[f])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-3 text-xs text-muted">
              Statement executed successfully.
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value === null) return "NULL";
  if (value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
