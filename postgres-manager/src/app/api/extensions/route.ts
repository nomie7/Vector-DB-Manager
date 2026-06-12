import { NextRequest } from "next/server";
import { listExtensions, createExtension, dropExtension } from "@/lib/pg-permissions";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const database = request.nextUrl.searchParams.get("database");
    if (!database) return fail(new Error("database is required"), 400);
    return ok({ extensions: await listExtensions(database) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { database, name } = await request.json();
    if (!database || !name)
      return fail(new Error("database and name are required"), 400);
    await createExtension(database, name);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { database, name } = await request.json();
    if (!database || !name)
      return fail(new Error("database and name are required"), 400);
    await dropExtension(database, name);
    return ok({ success: true });
  } catch (error) {
    return fail(error);
  }
}
