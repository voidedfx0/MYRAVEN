import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const address = typeof body === "object" && body !== null && "address" in body
    ? (body as { address?: unknown }).address
    : null;

  if (typeof address !== "string" || !BASE58_ADDRESS.test(address)) {
    return NextResponse.json({ error: "Enter a valid Solana public address." }, { status: 400 });
  }

  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

  try {
    const rpcResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "myraven-readonly-balance",
        method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });

    if (!rpcResponse.ok) {
      return NextResponse.json({ error: "Solana balance service is temporarily unavailable." }, { status: 502 });
    }

    const payload = await rpcResponse.json();
    if (payload.error || !Number.isFinite(payload.result?.value)) {
      return NextResponse.json({ error: "Could not verify this public wallet balance." }, { status: 502 });
    }

    const lamports = Number(payload.result.value);
    return NextResponse.json({
      address,
      lamports,
      sol: lamports / 1_000_000_000,
      network: "solana-mainnet",
      commitment: "confirmed",
      readOnly: true,
    }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Solana balance lookup timed out. Try again shortly." }, { status: 503 });
  }
}
