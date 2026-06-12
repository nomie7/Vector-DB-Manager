import { NextRequest } from "next/server";
import { listSchemas } from "@/lib/pg-data";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const database = request.nextUrl.searchParams.get("database");
    if (!database) return fail(new Error("database is required"), 400);
    return ok({ schemas: await listSchemas(database) });
  } catch (error) {
    return fail(error);
  }
}
