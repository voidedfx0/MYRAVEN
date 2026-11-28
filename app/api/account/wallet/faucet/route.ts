import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const LAMPORTS_PER_SOL = 1_000_000_000;

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to request Devnet SOL." }, { status: 401 });
  if (process.env.MYRAVEN_MODE !== "test" || (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase() !== "devnet") {
    return NextResponse.json({ error: "Devnet funding is available only in MYRAVEN test mode." }, { status: 409 });
  }

  const { data: wallet, error } = await supabase
    .from("user_solana_wallets")
    .select("wallet_address,status,network,custody_provider")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !wallet?.wallet_address || wallet.status !== "provisioned" || wallet.network !== "solana-devnet" || wallet.custody_provider !== "privy") {
    return NextResponse.json({ error: "Your MYRAVEN Devnet wallet is not ready yet." }, { status: 409 });
  }

  try {
    const response = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "myraven-devnet-airdrop",
        method: "requestAirdrop",
        params: [wallet.wallet_address, LAMPORTS_PER_SOL, { commitment: "confirmed" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json();
    if (!response.ok || payload?.error || typeof payload?.result !== "string") {
      const detail = String(payload?.error?.message ?? "The Devnet faucet rejected the request.");
      return NextResponse.json({ error: detail }, { status: 429 });
    }
    return NextResponse.json({
      requested: true,
      amountSol: 1,
      signature: payload.result,
      address: wallet.wallet_address,
      message: "1 Devnet SOL airdrop requested. Waiting for chain confirmation.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The Solana Devnet faucet is temporarily unavailable. Try again shortly." }, { status: 503 });
  }
}
