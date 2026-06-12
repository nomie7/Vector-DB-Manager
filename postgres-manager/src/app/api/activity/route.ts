import { NextRequest } from "next/server";
import { listActivity, cancelBackend, terminateBackend } from "@/lib/pg-activity";
import { ok, fail } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ activity: await listActivity() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pid, action } = await request.json();
    if (!pid || !action)
      return fail(new Error("pid and action are required"), 400);

    const ran =
      action === "terminate"
        ? await terminateBackend(Number(pid))
        : action === "cancel"
        ? await cancelBackend(Number(pid))
        : null;

    if (ran === null) return fail(new Error(`Unknown action: ${action}`), 400);
    return ok({ success: true, applied: ran });
  } catch (error) {
    return fail(error);
  }
}
