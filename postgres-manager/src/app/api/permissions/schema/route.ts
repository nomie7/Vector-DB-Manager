import { NextRequest } from "next/server";
import {
  getSchemaPrivileges,
  changeSchemaPrivilege,
  grantAllOnSchema,
  SchemaPrivilege,
} from "@/lib/pg-permissions";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const database = sp.get("database");
    const schema = sp.get("schema");
    if (!database || !schema)
      return fail(new Error("database and schema are required"), 400);
    return ok({ privileges: await getSchemaPrivileges(database, schema) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { database, schema, role, grant } = body;
    if (!database || !schema || !role)
      return fail(new Error("database, schema and role are required"), 400);

    // "bulk" applies GRANT/REVOKE ALL on every table+sequence in the schema.
    if (body.bulk) {
      await grantAllOnSchema({
        database,
        schema,
        role,
        grant: Boolean(grant),
        includeFuture: Boolean(body.includeFuture),
      });
      return ok({ success: true });
    }

    if (!body.privilege)
      return fail(new Error("privilege is required"), 400);
    await changeSchemaPrivilege({
      database,
      schema,
      role,
      privilege: body.privilege as SchemaPrivilege,
      grant: Boolean(grant),
    });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
