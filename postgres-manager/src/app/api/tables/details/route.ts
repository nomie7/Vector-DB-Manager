import { NextRequest } from "next/server";
import { getTableDetails } from "@/lib/pg-data";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const database = sp.get("database");
    const schema = sp.get("schema");
    const table = sp.get("table");
    if (!database || !schema || !table)
      return fail(new Error("database, schema and table are required"), 400);
    return ok(await getTableDetails(database, schema, table));
  } catch (error) {
    return fail(error);
  }
}
