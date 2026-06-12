import { NextRequest } from "next/server";
import { truncateTable, dropTable, TableInfo } from "@/lib/pg-data";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { database, schema, table, action, kind } = body;
    if (!database || !schema || !table || !action)
      return fail(new Error("database, schema, table and action are required"), 400);

    if (action === "truncate") {
      await truncateTable(database, schema, table);
    } else if (action === "drop") {
      await dropTable(database, schema, table, (kind as TableInfo["type"]) || "table");
    } else {
      return fail(new Error(`Unknown action: ${action}`), 400);
    }
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
