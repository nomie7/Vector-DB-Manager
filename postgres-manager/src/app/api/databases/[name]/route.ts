import { NextRequest } from "next/server";
import { dropDatabase } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const force = request.nextUrl.searchParams.get("force") === "true";
    await dropDatabase(decodeURIComponent(name), force);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
