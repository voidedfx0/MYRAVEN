import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getSolPriceUsd() {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  const data = await response.json().catch(() => null);
  const price = Number(data?.solana?.usd);
  if (!response.ok || !Number.isFinite(price) || price <= 0) throw new Error("Live SOL price is unavailable.");
  return price;
}

async function getCurrencyUsdRate(currency: string) {
  if (currency === "USD") return 1;
  const response = await fetch("https://open.er-api.com/v6/latest/" + encodeURIComponent(currency), { cache: "no-store" });
  const data = await response.json().catch(() => null);
  const rate = Number(data?.rates?.USD);
  if (!response.ok || data?.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Live " + currency + " exchange rate is unavailable.");
  }
  return rate;
}

export async function POST(request: Request) {
  if (process.env.MYRAVEN_MODE !== "test") {
    return NextResponse.json({ error: "Mock settlement is available only in test mode." }, { status: 403 });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { deposit_id?: string; outcome?: "success" | "failed" };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const depositId = String(body.deposit_id ?? "").trim();
  const outcome = body.outcome ?? "success";
  if (!depositId || !["success", "failed"].includes(outcome)) {
    return NextResponse.json({ error: "Provide a deposit ID and a valid outcome." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deposit, error } = await admin.from("funding_deposits")
    .select("id,user_id,status,input_amount,input_currency,metadata")
    .eq("id", depositId)
    .eq("user_id", user.id)
    .eq("provider_code", "flutterwave")
    .maybeSingle();

  if (error || !deposit) return NextResponse.json({ error: "Flutterwave deposit not found." }, { status: 404 });
  if (deposit.status !== "converting" || deposit.metadata?.payment_state !== "successful" || deposit.metadata?.environment !== "test") {
    return NextResponse.json({ error: "Only a successfully verified Flutterwave test payment can enter mock settlement." }, { status: 409 });
  }

  if (deposit.metadata?.mock_settlement?.transfer_status === "simulated_success") {
    return NextResponse.json({ status: "simulated_success", settlement: deposit.metadata.mock_settlement, already_settled: true });
  }

  const fiatAmount = Number(deposit.metadata?.verified_amount ?? deposit.input_amount);
  const fiatCurrency = String(deposit.metadata?.verified_currency ?? deposit.input_currency ?? "").toUpperCase();
  if (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || !/^[A-Z]{3}$/.test(fiatCurrency)) {
    return NextResponse.json({ error: "Verified deposit amount or currency is invalid." }, { status: 409 });
  }

  let solPriceUsd = 0;
  let fiatUsdRate = 0;
  let solAmount = 0;
  try {
    [solPriceUsd, fiatUsdRate] = await Promise.all([getSolPriceUsd(), getCurrencyUsdRate(fiatCurrency)]);
    solAmount = Number(((fiatAmount * fiatUsdRate) / solPriceUsd).toFixed(8));
    if (!Number.isFinite(solAmount) || solAmount <= 0) throw new Error("Calculated SOL amount is invalid.");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not calculate the live SOL conversion." }, { status: 503 });
  }

  const mock = {
    mode: "simulation",
    provider: "MYRAVEN mock settlement",
    network: "solana",
    fiat_amount: fiatAmount,
    fiat_currency: fiatCurrency,
    fiat_usd_rate: fiatUsdRate,
    fiat_usd_value: Number((fiatAmount * fiatUsdRate).toFixed(2)),
    sol_price_usd: solPriceUsd,
    sol_asset: "SOL",
    sol_amount: solAmount,
    quote_source: "CoinGecko SOL/USD + open.er-api.com FX",
    transfer_status: outcome === "success" ? "simulated_success" : "simulated_failure",
    conversion_status: outcome === "success" ? "simulated_success" : "not_run",
    wallet_credited: false,
    demo_balance_credit: outcome === "success" ? solAmount : 0,
    note: "Simulation only. No stablecoins were transferred and no wallet balance was changed.",
    completed_at: new Date().toISOString(),
  };

  const { error: updateError } = await admin.from("funding_deposits")
    .update({ metadata: { ...(deposit.metadata ?? {}), mock_settlement: mock } })
    .eq("id", deposit.id)
    .eq("user_id", user.id);

  if (updateError) return NextResponse.json({ error: "Could not save mock settlement result." }, { status: 500 });
  return NextResponse.json({ status: mock.transfer_status, settlement: mock });
}
