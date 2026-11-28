import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEST_MODE = process.env.MYRAVEN_MODE === "test";

function safeEqual(left: string | null, right: string | undefined) {
  if (!left || !right) return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!TEST_MODE) return new NextResponse("Test mode is not enabled", { status: 503 });
  const secretHash = process.env.FLW_SECRET_HASH;
  if (!safeEqual(request.headers.get("verif-hash"), secretHash)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let payload: { data?: { id?: number | string; tx_ref?: string; status?: string } };
  try { payload = await request.json(); } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const transactionId = payload.data?.id;
  const txRef = payload.data?.tx_ref;
  if (!transactionId || !txRef) return NextResponse.json({ received: true });

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) return new NextResponse("Provider not configured", { status: 503 });

  try {
    const verifyResponse = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(String(transactionId))}/verify`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      cache: "no-store",
    });
    const verification = await verifyResponse.json();
    const tx = verification?.data;
    if (!verifyResponse.ok || verification?.status !== "success" || tx?.status !== "successful" || tx?.tx_ref !== txRef) {
      return NextResponse.json({ received: true, verified: false });
    }

    const admin = createAdminClient();
    const { data: deposit } = await admin.from("funding_deposits")
      .select("id,input_amount,input_currency,status,metadata")
      .eq("provider_code", "flutterwave")
      .eq("provider_reference", txRef)
      .maybeSingle();

    if (!deposit || ["credited", "failed", "cancelled", "expired"].includes(deposit.status)) {
      return NextResponse.json({ received: true });
    }

    const paidAmount = Number(tx.amount);
    if (tx.currency !== deposit.input_currency || !Number.isFinite(paidAmount) || paidAmount < Number(deposit.input_amount)) {
      await admin.from("funding_deposits").update({ status: "recovery_pending", failure_code: "payment_mismatch" }).eq("id", deposit.id);
      return NextResponse.json({ received: true, verified: false });
    }

    // Fiat collection is confirmed. Do not credit SOL/USDC until an approved conversion and custody rail is connected.
    await admin.from("funding_deposits").update({
      status: "converting",
      metadata: { ...(deposit.metadata ?? {}), flutterwave_transaction_id: String(transactionId), verified_currency: tx.currency, verified_amount: paidAmount, payment_state: "successful", conversion_state: "simulation_pending", environment: "test" },
    }).eq("id", deposit.id);

    return NextResponse.json({ received: true, verified: true });
  } catch {
    return new NextResponse("Temporary processing failure", { status: 500 });
  }
}
