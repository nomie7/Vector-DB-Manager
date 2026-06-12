import { NextRequest } from "next/server";
import { setRolePassword, generatePassword } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Set or rotate a role's password. If no password is supplied, a strong one is
 * generated server-side and returned once so the caller can copy it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const body = await request.json().catch(() => ({}));

    const generated = !body.password;
    const password: string = body.password || generatePassword();

    await setRolePassword(
      decodeURIComponent(name),
      password,
      body.validUntil || undefined
    );

    // Only echo the password back when we generated it for the user.
    return ok({ success: true, password: generated ? password : undefined });
  } catch (error) {
    return fail(error);
  }
}
