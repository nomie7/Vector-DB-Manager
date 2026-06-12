import { NextRequest } from "next/server";
import { listTables } from "@/lib/pg-data";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const database = sp.get("database");
    const schema = sp.get("schema");
    if (!database || !schema)
      return fail(new Error("database and schema are required"), 400);
    return ok({ tables: await listTables(database, schema) });
  } catch (error) {
    return fail(error);
  }
}
