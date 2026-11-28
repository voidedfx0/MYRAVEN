import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toStripeMinorUnits, isStripeTestKey } from "@/lib/payments/stripe";
import countriesData from "@/src/data/funding-countries.json";

export const dynamic = "force-dynamic";

const TEST_MODE = process.env.MYRAVEN_MODE === "test";
const countries = countriesData.countries as Array<{ code: string; currency: string[] }>;

export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!TEST_MODE || !isStripeTestKey(secretKey)) {
    return NextResponse.json(
      { error: "Stripe checkout is available only with MYRAVEN test mode and a Stripe test secret key.", code: "TEST_MODE_REQUIRED" },
      { status: 503 },
    );
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before funding your wallet." }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "Add an email address before starting a card payment." }, { status: 400 });

  let body: { amount?: number; countryCode?: string; currency?: string; targetAsset?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const countryCode = String(body.countryCode ?? "").toUpperCase();
  const currency = String(body.currency ?? "").toUpperCase();
  const amount = Number(body.amount);
  const targetAsset = String(body.targetAsset ?? "USDC").toUpperCase();
  const country = countries.find((item) => item.code === countryCode);

  if (!country || !country.currency.includes(currency) ||
      !/^[A-Z]{3}$/.test(currency) ||
      !["SOL", "USDC"].includes(targetAsset) ||
      !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return NextResponse.json({ error: "Check the country, currency, wallet asset and amount." }, { status: 400 });
  }

  let amountMinor: number;
  try { amountMinor = toStripeMinorUnits(amount, currency); } catch {
    return NextResponse.json({ error: "The funding amount is invalid for this currency." }, { status: 400 });
  }

  const admin = createAdminClient();
  const txRef = "MRV-STRIPE-" + randomUUID();
  const { data: deposit, error: insertError } = await admin.from("funding_deposits").insert({
    user_id: user.id,
    funding_method: "card",
    input_kind: "fiat",
    input_currency: currency,
    input_amount: amount,
    target_asset: targetAsset,
    chain_code: "SOLANA",
    provider_code: "stripe",
    provider_reference: txRef,
    idempotency_key: txRef,
    status: "created",
    metadata: {
      country_code: countryCode,
      requested_method: "card",
      provider: "stripe",
      environment: "test",
      conversion_state: "awaiting_conversion_provider",
    },
  }).select("id").single();

  if (insertError || !deposit) {
    return NextResponse.json({ error: "Could not create the funding request." }, { status: 500 });
  }

  const origin = new URL(request.url).origin;
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("payment_method_types[0]", "card");
  form.set("success_url", `${origin}/dashboard?funding=stripe-return&session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${origin}/dashboard?funding=stripe-cancelled`);
  form.set("customer_email", user.email);
  form.set("client_reference_id", deposit.id);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", currency.toLowerCase());
  form.set("line_items[0][price_data][unit_amount]", String(amountMinor));
  form.set("line_items[0][price_data][product_data][name]", "MYRAVEN wallet funding (test)");
  form.set("line_items[0][price_data][product_data][description]", `Test card funding for ${targetAsset} on Solana`);
  form.set("metadata[myraven_deposit_id]", deposit.id);
  form.set("metadata[myraven_user_id]", user.id);
  form.set("metadata[country_code]", countryCode);
  form.set("metadata[target_asset]", targetAsset);
  form.set("metadata[environment]", "test");
  form.set("payment_intent_data[metadata][myraven_deposit_id]", deposit.id);
  form.set("payment_intent_data[metadata][myraven_user_id]", user.id);
  form.set("payment_intent_data[metadata][environment]", "test");

  try {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": txRef,
      },
      body: form.toString(),
      cache: "no-store",
    });
    const session = await response.json().catch(() => null);
    if (!response.ok || typeof session?.url !== "string" || typeof session?.id !== "string") {
      const providerMessage = typeof session?.error?.message === "string"
        ? session.error.message.slice(0, 220)
        : "Stripe did not return a checkout session.";
      await admin.from("funding_deposits").update({
        status: "failed",
        failure_code: "stripe_checkout_failed",
        metadata: { country_code: countryCode, provider: "stripe", environment: "test", provider_error: providerMessage },
      }).eq("id", deposit.id);
      console.error("[MYRAVEN Stripe] Checkout session creation failed", { message: providerMessage, currency, countryCode });
      return NextResponse.json({ error: "Stripe could not start this test card checkout. Check the currency and Stripe test account settings." }, { status: 502 });
    }

    await admin.from("funding_deposits").update({
      status: "awaiting_payment",
      provider_reference: session.id,
      metadata: {
        country_code: countryCode,
        requested_method: "card",
        provider: "stripe",
        environment: "test",
        stripe_checkout_session_id: session.id,
        conversion_state: "awaiting_conversion_provider",
      },
    }).eq("id", deposit.id);

    return NextResponse.json({ checkoutUrl: session.url, depositId: deposit.id, status: "awaiting_payment" });
  } catch {
    await admin.from("funding_deposits").update({ status: "failed", failure_code: "stripe_unreachable" }).eq("id", deposit.id);
    return NextResponse.json({ error: "Stripe is temporarily unreachable." }, { status: 502 });
  }
}
