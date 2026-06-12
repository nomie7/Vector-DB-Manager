import { NextRequest } from "next/server";
import {
  getTablePrivileges,
  changeTablePrivilege,
  TablePrivilege,
} from "@/lib/pg-permissions";
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
    return ok({ privileges: await getTablePrivileges(database, schema, table) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { database, schema, table, role, privilege, grant } = body;
    if (!database || !schema || !table || !role || !privilege)
      return fail(
        new Error("database, schema, table, role and privilege are required"),
        400
      );
    await changeTablePrivilege({
      database,
      schema,
      table,
      role,
      privilege: privilege as TablePrivilege,
      grant: Boolean(grant),
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
