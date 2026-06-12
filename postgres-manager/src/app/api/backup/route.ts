import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import { dumpDatabase, DumpFormat } from "@/lib/pg-backup";

export const dynamic = "force-dynamic";
// pg_dump can run longer than the default; allow more time.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const database = sp.get("database");
  const format = (sp.get("format") as DumpFormat) || "plain";
  if (!database) {
    return NextResponse.json({ error: "database is required" }, { status: 400 });
  }

  try {
    const { stream, done, filename } = dumpDatabase(database, format);

    // Surface a pg_dump failure (e.g. permission denied) instead of hanging.
    done.catch((err) => {
      console.error("pg_dump failed:", err.message);
      stream.destroy(err);
    });

    const webStream = Readable.toWeb(stream) as unknown as ReadableStream;
    return new NextResponse(webStream, {
      headers: {
        "Content-Type":
          format === "custom"
            ? "application/octet-stream"
            : "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
