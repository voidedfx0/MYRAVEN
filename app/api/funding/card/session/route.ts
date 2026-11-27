import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FIAT_CURRENCIES = new Set(["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "NGN", "KES", "GHS"]);
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function getUserIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  return (forwarded?.split(",")[0]?.trim() || realIp || "").slice(0, 64);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to MYRAVEN before starting card funding." }, { status: 401 });
  }

  let body: { amount?: unknown; currency?: unknown; walletAddress?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid card funding request." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : "";

  if (!Number.isFinite(amount) || amount < 10 || amount > 500) {
    return NextResponse.json({ error: "Sandbox purchases must be between 10 and 500." }, { status: 400 });
  }
  if (!FIAT_CURRENCIES.has(currency)) {
    return NextResponse.json({ error: "Choose a supported sandbox fiat currency." }, { status: 400 });
  }
  if (!SOLANA_ADDRESS.test(walletAddress)) {
    return NextResponse.json({ error: "Connect a valid Solana wallet before continuing." }, { status: 400 });
  }

  // This endpoint is deliberately pinned to Transak STAGING. There is no
  // production URL or live-payment switch in this route.
  const apiKey = process.env.TRANSAK_STAGING_API_KEY;
  const apiSecret = process.env.TRANSAK_STAGING_API_SECRET;
  if (!apiKey || !apiSecret) {
    return NextResponse.json({
      error: "Card sandbox is not connected yet. Add the Transak STAGING API key and API secret in Vercel to enable test checkout.",
    }, { status: 503 });
  }

  const userIp = getUserIp(request);
  if (!userIp) {
    return NextResponse.json({ error: "Could not determine the request IP required by the sandbox provider." }, { status: 400 });
  }

  try {
    const tokenResponse = await fetch("https://api-stg.transak.com/partners/api/v2/refresh-token", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-secret": apiSecret,
      },
      body: JSON.stringify({ apiKey }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const tokenPayload = await tokenResponse.json();
    const accessToken = tokenPayload?.data?.accessToken;
    if (!tokenResponse.ok || typeof accessToken !== "string") {
      return NextResponse.json({ error: "The card provider did not authorize the staging session. Check the Transak staging credentials." }, { status: 502 });
    }

    const sessionResponse = await fetch("https://api-gateway-stg.transak.com/api/v2/auth/session", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "access-token": accessToken,
        "x-api-key": apiKey,
        "x-user-ip": userIp,
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey,
          referrerDomain: "myraven.vercel.app",
          productsAvailed: "BUY",
          fiatAmount: amount,
          fiatCurrency: currency,
          cryptoCurrencyCode: "SOL",
          network: "solana",
          paymentMethod: "credit_debit_card",
          walletAddress,
          disableWalletAddressForm: true,
          hideExchangeScreen: true,
          email: user.email ?? undefined,
          themeColor: "#8b72ff",
          colorMode: "DARK",
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const sessionPayload = await sessionResponse.json();
    const widgetUrl = sessionPayload?.data?.widgetUrl;
    if (!sessionResponse.ok || typeof widgetUrl !== "string") {
      return NextResponse.json({ error: "The provider could not create a card checkout session. Check the staging domain and IP allowlist." }, { status: 502 });
    }

    const parsedUrl = new URL(widgetUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "global-stg.transak.com") {
      return NextResponse.json({ error: "The provider returned an invalid staging checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ widgetUrl, environment: "staging", network: "solana", asset: "SOL" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Card sandbox is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}
