import { NextRequest } from "next/server";
import { runSql } from "@/lib/postgres";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sql = String(body.sql || "").trim();
    if (!sql) return fail(new Error("SQL statement is required"), 400);

    const result = await runSql(sql, body.database || undefined);
    return ok({ success: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
