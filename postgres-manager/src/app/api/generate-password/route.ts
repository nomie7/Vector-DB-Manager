import { NextRequest } from "next/server";
import { generatePassword } from "@/lib/postgres";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const lengthParam = Number(request.nextUrl.searchParams.get("length") || "24");
  const length = Math.min(Math.max(lengthParam || 24, 8), 128);
  return ok({ password: generatePassword(length) });
}
