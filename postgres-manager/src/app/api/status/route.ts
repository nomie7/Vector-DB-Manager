import { getStatus } from "@/lib/postgres";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getStatus();
    return ok({ connected: true, ...status });
  } catch (error) {
    // Report a disconnected state (200) so the UI can render a friendly banner
    // with the underlying reason instead of a hard error.
    const message =
      error instanceof Error ? error.message : "Could not connect to Postgres";
    return ok({ connected: false, error: message });
  }
}
