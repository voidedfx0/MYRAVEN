import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DEVNET_RPC = "https://api.devnet.solana.com";

function getDevnetRpc() {
  const configuredNetwork = (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase();
  const rpcUrl = process.env.SOLANA_RPC_URL ?? DEVNET_RPC;
  let parsed: URL;
  try { parsed = new URL(rpcUrl); } catch { return null; }
  const host = parsed.hostname.toLowerCase();
  const isDevnetHost = host === "api.devnet.solana.com" || host.startsWith("devnet.") || host.includes(".devnet.");
  if (configuredNetwork !== "devnet" || !isDevnetHost || parsed.protocol !== "https:") return null;
  return { url: rpcUrl, provider: host.includes("helius") ? "Helius Devnet" : "Solana Devnet RPC" };
}

export async function GET() {
  const rpc = getDevnetRpc();
  if (!rpc) {
    return NextResponse.json({ configured: false, network: "devnet", error: "MYRAVEN is locked to Solana Devnet. Configure a Devnet RPC endpoint." }, { status: 503 });
  }
  return NextResponse.json({ configured: true, provider: rpc.provider, network: "devnet", readOnly: true, testMode: true }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const address = typeof body === "object" && body !== null && "address" in body
    ? (body as { address?: unknown }).address
    : null;
  if (typeof address !== "string" || !BASE58_ADDRESS.test(address)) {
    return NextResponse.json({ error: "Enter a valid Solana public address." }, { status: 400 });
  }

  const rpc = getDevnetRpc();
  if (!rpc) {
    return NextResponse.json({ error: "MYRAVEN is locked to Solana Devnet. A Devnet RPC endpoint is required." }, { status: 503 });
  }

  try {
    const rpcResponse = await fetch(rpc.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "myraven-devnet-readonly-balance",
        method: "getBalance",
        params: [address, { commitment: "confirmed" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!rpcResponse.ok) {
      return NextResponse.json({ error: "Solana Devnet balance service is temporarily unavailable." }, { status: 502 });
    }
    const payload = await rpcResponse.json();
    if (payload.error || !Number.isFinite(payload.result?.value)) {
      return NextResponse.json({ error: "Could not verify this Devnet wallet balance." }, { status: 502 });
    }
    const lamports = Number(payload.result.value);
    return NextResponse.json({
      address, lamports, sol: lamports / 1_000_000_000,
      network: "devnet", commitment: "confirmed", readOnly: true,
      testMode: true, provider: rpc.provider,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Solana Devnet balance lookup timed out. Try again shortly." }, { status: 503 });
  }
}
