import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Card funding is intentionally unavailable until a supported provider and
// MYRAVEN account-settlement flow have been approved and integrated.
export async function POST() {
  return NextResponse.json(
    { error: "Card funding is coming soon. No payment session can be created yet." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
