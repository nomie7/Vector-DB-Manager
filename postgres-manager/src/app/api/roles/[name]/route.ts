import { NextRequest } from "next/server";
import { alterRole, dropRole, RoleAttributes } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json();

    const attrs: RoleAttributes = {};
    for (const key of [
      "login",
      "superuser",
      "createDb",
      "createRole",
      "replication",
      "inherit",
    ] as const) {
      if (body[key] !== undefined) attrs[key] = Boolean(body[key]);
    }
    if (body.connectionLimit !== undefined && body.connectionLimit !== "")
      attrs.connectionLimit = Number(body.connectionLimit);
    if (body.validUntil !== undefined) attrs.validUntil = body.validUntil || null;

    await alterRole(decodeURIComponent(name), attrs);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    await dropRole(decodeURIComponent(name));
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
