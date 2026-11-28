import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPPORTED = /^[A-Z]{3}$/;

export async function GET(request: Request) {
  const currency = (new URL(request.url).searchParams.get("currency") ?? "USD").toUpperCase();
  if (!SUPPORTED.test(currency)) return NextResponse.json({ error: "Invalid currency." }, { status: 400 });

  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=" + encodeURIComponent(currency),
      { cache: "no-store", headers: { accept: "application/json" } }
    );
    const data = await response.json().catch(() => null);
    const price = Number(data?.solana?.[currency.toLowerCase()]);
    if (!response.ok || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Live SOL price is temporarily unavailable." }, { status: 503 });
    }
    return NextResponse.json({ asset: "SOL", currency, price, source: "CoinGecko", updatedAt: new Date().toISOString() }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Live SOL price is temporarily unavailable." }, { status: 503 });
  }
}
