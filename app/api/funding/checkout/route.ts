import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import countriesData from "@/src/data/funding-countries.json";

export const dynamic = "force-dynamic";

const TEST_MODE = process.env.MYRAVEN_MODE === "test";

const allowedAssets = ["SOL", "USDC"] as const;
const methods = ["card", "bank_transfer", "local_payment"] as const;
const countries = countriesData.countries as Array<{ code: string; currency: string[] }>;

export async function POST(request: Request) {
  if (!TEST_MODE) return NextResponse.json({ error: "MYRAVEN funding is disabled unless test mode is explicitly enabled." }, { status: 503 });
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in before funding your wallet." }, { status: 401 });
  if (!user.email) return NextResponse.json({ error: "Add and verify an email address before starting a Flutterwave payment." }, { status: 400 });

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({
      error: "Flutterwave test credentials are not connected yet. The funding route is prepared, but checkout is not active.",
      code: "PROVIDER_NOT_CONFIGURED",
    }, { status: 503 });
  }

  let body: { amount?: number; countryCode?: string; currency?: string; method?: string; targetAsset?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const countryCode = String(body.countryCode ?? "").toUpperCase();
  const currency = String(body.currency ?? "").toUpperCase();
  const method = String(body.method ?? "card");
  const amount = Number(body.amount);
  const targetAsset = String(body.targetAsset ?? "USDC").toUpperCase();
  const country = countries.find((item) => item.code === countryCode);

  if (!country || !country.currency.includes(currency) || !methods.includes(method as typeof methods[number]) ||
      !allowedAssets.includes(targetAsset as typeof allowedAssets[number]) ||
      !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
    return NextResponse.json({ error: "Check the country, currency, method and amount." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const txRef = "MRV-FUND-" + randomUUID();
  const admin = createAdminClient();

  const { data: deposit, error: insertError } = await admin.from("funding_deposits").insert({
    user_id: user.id,
    funding_method: method,
    input_kind: "fiat",
    input_currency: currency,
    input_amount: amount,
    target_asset: targetAsset,
    chain_code: "SOLANA",
    provider_code: "flutterwave",
    provider_reference: txRef,
    idempotency_key: txRef,
    status: "created",
    metadata: { country_code: countryCode, requested_method: method, provider: "flutterwave", environment: "test" },
  }).select("id").single();

  if (insertError || !deposit) {
    return NextResponse.json({ error: "Could not create the funding request." }, { status: 500 });
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/payments", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_ref: txRef,
        amount: amount.toFixed(2),
        currency,
        redirect_url: `${origin}/dashboard?funding=return`,
        customer: { email: user.email, name: user.user_metadata?.full_name ?? user.email },
        customizations: { title: "MYRAVEN wallet funding", description: `Add funds to your MYRAVEN wallet (${targetAsset})` },
        meta: { funding_deposit_id: deposit.id, user_id: user.id, country_code: countryCode, target_asset: targetAsset, environment: "test" },
      }),
      cache: "no-store",
    });
    const result = await response.json();
    const checkoutUrl = result?.data?.link;
    if (!response.ok || result?.status !== "success" || typeof checkoutUrl !== "string" ||
        !checkoutUrl.startsWith("https://checkout.flutterwave.com/")) {
      await admin.from("funding_deposits").update({ status: "failed", failure_code: "provider_checkout_failed" }).eq("id", deposit.id);
      return NextResponse.json({ error: "Flutterwave could not start checkout. Try again later." }, { status: 502 });
    }

    await admin.from("funding_deposits").update({ status: "awaiting_payment" }).eq("id", deposit.id);
    return NextResponse.json({ checkoutUrl, depositId: deposit.id, status: "awaiting_payment" });
  } catch {
    await admin.from("funding_deposits").update({ status: "failed", failure_code: "provider_unreachable" }).eq("id", deposit.id);
    return NextResponse.json({ error: "Flutterwave is temporarily unreachable." }, { status: 502 });
  }
}
