import { NextRequest } from "next/server";
import { getTableData } from "@/lib/pg-data";
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

    const data = await getTableData(database, schema, table, {
      limit: Number(sp.get("limit") || 50),
      offset: Number(sp.get("offset") || 0),
      orderBy: sp.get("orderBy") || undefined,
      orderDir: sp.get("orderDir") || undefined,
    });
    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
