import { NextResponse } from "next/server";

export function ok(data: unknown = { success: true }) {
  return NextResponse.json(data);
}

/** Turn a thrown value (often a Postgres error) into a clean JSON response. */
export function fail(error: unknown, status = 500) {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  // Postgres errors carry a `code` we can surface for nicer client messages.
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code
      : undefined;
  console.error("API error:", message);
  return NextResponse.json({ error: message, code }, { status });
}
