import { NextRequest } from "next/server";
import { listDatabases, createDatabase } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ databases: await listDatabases() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return fail(new Error("Database name is required"), 400);

    await createDatabase({
      name,
      owner: body.owner || undefined,
      encoding: body.encoding || undefined,
      template: body.template || undefined,
    });
    return ok({ success: true, name });
  } catch (error) {
    return fail(error);
  }
}
