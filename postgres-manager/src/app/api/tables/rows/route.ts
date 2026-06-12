import { NextRequest } from "next/server";
import { insertRow, updateRow, deleteRow } from "@/lib/pg-data";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

function requireTarget(body: Record<string, unknown>) {
  if (!body.database || !body.schema || !body.table)
    throw new Error("database, schema and table are required");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    requireTarget(body);
    const row = await insertRow(body.database, body.schema, body.table, body.values || {});
    return ok({ success: true, row });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    requireTarget(body);
    if (!body.pk) return fail(new Error("primary key (pk) is required"), 400);
    const row = await updateRow(
      body.database,
      body.schema,
      body.table,
      body.pk,
      body.values || {}
    );
    return ok({ success: true, row });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    requireTarget(body);
    if (!body.pk) return fail(new Error("primary key (pk) is required"), 400);
    await deleteRow(body.database, body.schema, body.table, body.pk);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
