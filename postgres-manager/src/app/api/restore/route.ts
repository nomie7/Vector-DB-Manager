import { NextRequest } from "next/server";
import { restoreDatabase, DumpFormat } from "@/lib/pg-backup";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const database = form.get("database");
    const file = form.get("file");
    let format = (form.get("format") as DumpFormat) || "plain";

    if (typeof database !== "string" || !database)
      return fail(new Error("database is required"), 400);
    if (!(file instanceof File))
      return fail(new Error("a dump file is required"), 400);

    const buffer = Buffer.from(await file.arrayBuffer());

    // Auto-detect custom-format dumps (they start with the magic "PGDMP").
    if (buffer.subarray(0, 5).toString("latin1") === "PGDMP") format = "custom";

    const output = await restoreDatabase(database, buffer, format);
    return ok({ success: true, output });
  } catch (error) {
    return fail(error);
  }
}
