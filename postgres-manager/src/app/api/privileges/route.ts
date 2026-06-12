import { NextRequest } from "next/server";
import {
  getDatabasePrivileges,
  changeDatabasePrivilege,
  DbPrivilege,
} from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const database = request.nextUrl.searchParams.get("database");
    if (!database) return fail(new Error("database query param is required"), 400);
    return ok({ privileges: await getDatabasePrivileges(database) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { database, role, privilege, grant } = body;
    if (!database || !role || !privilege)
      return fail(new Error("database, role and privilege are required"), 400);

    await changeDatabasePrivilege({
      database,
      role,
      privilege: privilege as DbPrivilege,
      grant: Boolean(grant),
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
