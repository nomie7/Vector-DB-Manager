import { NextRequest } from "next/server";
import { listRoles, createRole, RoleAttributes } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ roles: await listRoles() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    if (!name) return fail(new Error("Role name is required"), 400);

    const attrs: RoleAttributes = {
      login: body.login ?? true,
      superuser: body.superuser ?? false,
      createDb: body.createDb ?? false,
      createRole: body.createRole ?? false,
      replication: body.replication ?? false,
    };
    if (body.connectionLimit !== undefined && body.connectionLimit !== "")
      attrs.connectionLimit = Number(body.connectionLimit);
    if (body.validUntil) attrs.validUntil = String(body.validUntil);

    await createRole({ name, password: body.password || undefined, attrs });
    return ok({ success: true, name });
  } catch (error) {
    return fail(error);
  }
}
