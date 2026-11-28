import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TEST_MODE = process.env.MYRAVEN_MODE === "test";

export async function POST(request: Request) {
  if (!TEST_MODE) return NextResponse.json({ error: "Test mode is not enabled." }, { status: 503 });

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to reconcile this payment." }, { status: 401 });

  let body: { tx_ref?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const txRef = String(body.tx_ref ?? "").trim();
  if (!/^MRV-FUND-[0-9a-f-]{36}$/i.test(txRef)) {
    return NextResponse.json({ error: "Invalid funding reference." }, { status: 400 });
  }

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) return NextResponse.json({ error: "Flutterwave test credentials are not configured." }, { status: 503 });

  const admin = createAdminClient();
  const { data: deposit, error } = await admin.from("funding_deposits")
    .select("id,user_id,input_amount,input_currency,status,metadata")
    .eq("provider_code", "flutterwave")
    .eq("provider_reference", txRef)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !deposit) return NextResponse.json({ error: "Funding request not found." }, { status: 404 });
  if (deposit.status === "converting" && deposit.metadata?.payment_state === "successful") {
    return NextResponse.json({ status: "converting", paymentStatus: "successful", conversionStatus: deposit.metadata?.treasury_settlement?.transfer_status === "confirmed" ? "confirmed" : "pending" });
  }
  if (["credited", "failed", "cancelled", "expired"].includes(deposit.status)) {
    return NextResponse.json({ status: deposit.status });
  }

  try {
    const verifyResponse = await fetch(
      "https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=" + encodeURIComponent(txRef),
      { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" }
    );
    const verification = await verifyResponse.json().catch(() => null);
    const tx = verification?.data;
    if (!verifyResponse.ok || verification?.status !== "success" || tx?.status !== "successful" || tx?.tx_ref !== txRef) {
      return NextResponse.json({ status: "awaiting_payment", verified: false });
    }

    const paidAmount = Number(tx.amount);
    if (tx.currency !== deposit.input_currency || !Number.isFinite(paidAmount) || paidAmount < Number(deposit.input_amount)) {
      await admin.from("funding_deposits").update({ status: "recovery_pending", failure_code: "payment_mismatch" }).eq("id", deposit.id);
      return NextResponse.json({ error: "Payment details require manual review.", status: "recovery_pending" }, { status: 409 });
    }

    await admin.from("funding_deposits").update({
      status: "converting",
      failure_code: null,
      metadata: {
        ...(deposit.metadata ?? {}),
        flutterwave_transaction_id: String(tx.id),
        flutterwave_reference: tx.flw_ref ?? null,
        verified_currency: tx.currency,
        verified_amount: paidAmount,
        payment_state: "successful",
        conversion_state: "awaiting_conversion_provider",
        environment: "test",
      },
    }).eq("id", deposit.id);

    return NextResponse.json({ status: "converting", paymentStatus: "successful", conversionStatus: "pending" });
  } catch {
    return NextResponse.json({ error: "Could not verify the payment yet. Refresh funding activity shortly." }, { status: 502 });
  }
}
