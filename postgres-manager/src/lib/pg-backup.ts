import { spawn } from "child_process";
import { Readable } from "stream";
import { resolveConnection } from "./postgres";

export type DumpFormat = "plain" | "custom";

function cliEnv(): NodeJS.ProcessEnv {
  const conn = resolveConnection();
  return {
    ...process.env,
    PGHOST: conn.host,
    PGPORT: String(conn.port),
    PGUSER: conn.user,
    PGPASSWORD: conn.password,
    ...(String(process.env.PGSSL).toLowerCase() === "true"
      ? { PGSSLMODE: "require" }
      : {}),
  };
}

/**
 * Stream a pg_dump of `database`. Returns a Node Readable of the dump bytes
 * plus a promise that rejects if pg_dump exits non-zero.
 */
export function dumpDatabase(
  database: string,
  format: DumpFormat
): { stream: Readable; done: Promise<void>; filename: string } {
  const args = [
    "--no-password",
    "-d",
    database,
    "-F",
    format === "custom" ? "c" : "p",
  ];
  const child = spawn("pg_dump", args, { env: cliEnv() });

  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });

  const done = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `pg_dump exited with code ${code}`));
    });
  });

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = format === "custom" ? "dump" : "sql";
  return { stream: child.stdout, done, filename: `${database}-${ts}.${ext}` };
}

/**
 * Restore a dump into `database`. Plain-SQL dumps are piped through psql;
 * custom-format dumps go through pg_restore.
 */
export function restoreDatabase(
  database: string,
  data: Buffer,
  format: DumpFormat
): Promise<string> {
  return new Promise((resolve, reject) => {
    const isCustom = format === "custom";
    const cmd = isCustom ? "pg_restore" : "psql";
    const args = isCustom
      ? ["--no-password", "-d", database]
      : ["--no-password", "-v", "ON_ERROR_STOP=1", "-d", database];

    const child = spawn(cmd, args, { env: cliEnv() });

    let stderr = "";
    let stdout = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout || "Restore completed successfully.");
      else reject(new Error(stderr.trim() || `${cmd} exited with code ${code}`));
    });

    child.stdin.write(data);
    child.stdin.end();
  });
}
