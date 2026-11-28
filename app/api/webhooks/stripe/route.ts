import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { toStripeMinorUnits } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

const TEST_MODE = process.env.MYRAVEN_MODE === "test";

function verifyStripeSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;

  const timestampNumber = Number(timestamp);
  if (!Number.isSafeInteger(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const received = Buffer.from(signature, "hex");
    return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
  });
}

type StripeSession = {
  id?: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number;
  currency?: string;
  metadata?: Record<string, string>;
  payment_intent?: string | { id?: string } | null;
};

export async function POST(request: Request) {
  if (!TEST_MODE) return new NextResponse("MYRAVEN test mode is not enabled", { status: 503 });

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !secret.startsWith("whsec_")) return new NextResponse("Webhook is not configured", { status: 503 });

  const rawBody = await request.text();
  if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), secret)) {
    return new NextResponse("Invalid Stripe signature", { status: 400 });
  }

  let event: { id?: string; type?: string; data?: { object?: StripeSession & Record<string, unknown> } };
  try { event = JSON.parse(rawBody); } catch {
    return new NextResponse("Invalid event body", { status: 400 });
  }

  const object = event.data?.object;
  if (!object || !event.type) return NextResponse.json({ received: true });

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = object as StripeSession;
    const depositId = session.metadata?.myraven_deposit_id;
    const userId = session.metadata?.myraven_user_id;
    if (!depositId || !userId || !session.id || session.mode !== "payment") {
      return NextResponse.json({ received: true, ignored: true });
    }

    const { data: deposit, error } = await admin.from("funding_deposits")
      .select("id,user_id,input_amount,input_currency,target_asset,provider_code,provider_reference,status,metadata")
      .eq("id", depositId)
      .eq("provider_code", "stripe")
      .eq("provider_reference", session.id)
      .maybeSingle();

    if (error) return new NextResponse("Could not load funding request", { status: 500 });
    if (!deposit || deposit.user_id !== userId) return NextResponse.json({ received: true, ignored: true });
    if (["converting", "submitted_onchain", "confirming", "credited"].includes(deposit.status)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, paid: false });
    }

    const currency = String(session.currency ?? "").toUpperCase();
    let expectedMinor: number;
    try { expectedMinor = toStripeMinorUnits(Number(deposit.input_amount), deposit.input_currency); } catch {
      return new NextResponse("Invalid stored funding amount", { status: 500 });
    }
    if (currency !== deposit.input_currency || session.amount_total !== expectedMinor) {
      await admin.from("funding_deposits").update({
        status: "recovery_pending",
        failure_code: "stripe_payment_mismatch",
        metadata: {
          ...(deposit.metadata ?? {}),
          stripe_event_id: event.id ?? null,
          stripe_checkout_session_id: session.id,
          stripe_payment_status: session.payment_status,
          received_currency: currency,
          received_amount_minor: session.amount_total ?? null,
          environment: "test",
        },
      }).eq("id", deposit.id);
      return NextResponse.json({ received: true, reviewRequired: true });
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

    const { error: updateError } = await admin.from("funding_deposits").update({
      status: "converting",
      failure_code: null,
      metadata: {
        ...(deposit.metadata ?? {}),
        stripe_event_id: event.id ?? null,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_payment_status: "paid",
        verified_currency: currency,
        verified_amount_minor: expectedMinor,
        conversion_state: "awaiting_conversion_provider",
        environment: "test",
      },
    }).eq("id", deposit.id).in("status", ["created", "awaiting_payment", "processing"]);

    if (updateError) return new NextResponse("Could not update funding request", { status: 500 });
    return NextResponse.json({ received: true, verified: true, walletCredited: false });
  }

  if (event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired") {
    const session = object as StripeSession;
    if (session.id) {
      await admin.from("funding_deposits").update({
        status: event.type.endsWith("expired") ? "expired" : "failed",
        failure_code: event.type.endsWith("expired") ? "stripe_checkout_expired" : "stripe_payment_failed",
        metadata: { stripe_checkout_session_id: session.id, environment: "test" },
      }).eq("provider_code", "stripe").eq("provider_reference", session.id).in("status", ["created", "awaiting_payment", "processing"]);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "charge.refunded") {
    const paymentIntent = object.payment_intent;
    const paymentIntentId = typeof paymentIntent === "string" ? paymentIntent : null;
    if (paymentIntentId) {
      const { data: deposits } = await admin.from("funding_deposits")
        .select("id,metadata")
        .eq("provider_code", "stripe")
        .contains("metadata", { stripe_payment_intent_id: paymentIntentId })
        .limit(1);
      const deposit = deposits?.[0];
      if (deposit) {
        await admin.from("funding_deposits").update({
          status: "recovery_pending",
          failure_code: "stripe_refund_requires_review",
          metadata: { ...(deposit.metadata ?? {}), stripe_refunded: true, environment: "test" },
        }).eq("id", deposit.id).not("status", "in", "(failed,cancelled,expired)");
      }
    }
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true, ignored: true });
}
