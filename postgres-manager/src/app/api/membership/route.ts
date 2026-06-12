import { NextRequest } from "next/server";
import { setRoleMembership } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, group, grant } = body;
    if (!role || !group)
      return fail(new Error("role and group are required"), 400);
    await setRoleMembership({ role, group, grant: Boolean(grant) });
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
