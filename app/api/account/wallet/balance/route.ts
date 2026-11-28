import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEVNET_RPC = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to view your SOL balance." }, { status: 401 });
  }

  const { data: wallet, error } = await supabase
    .from("user_solana_wallets")
    .select("wallet_address,status,network,custody_provider")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Your MYRAVEN wallet could not be loaded." }, { status: 503 });
  }

  if (!wallet?.wallet_address || wallet.status !== "provisioned" || wallet.network !== "solana-devnet" || wallet.custody_provider !== "privy") {
    return NextResponse.json({ error: "Your Privy Devnet wallet is not ready.", availableSol: null }, { status: 409 });
  }

  try {
    const response = await fetch(DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "myraven-sol-balance",
        method: "getBalance",
        params: [wallet.wallet_address, { commitment: "confirmed" }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json();
    const lamports = Number(payload?.result?.value);
    if (!response.ok || !Number.isSafeInteger(lamports) || lamports < 0 || payload?.error) {
      throw new Error("Solana RPC balance lookup failed.");
    }

    return NextResponse.json({
      address: wallet.wallet_address,
      network: "solana-devnet",
      asset: "SOL",
      availableSol: lamports / 1_000_000_000,
      lamports,
      source: "Solana Devnet",
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not read your live Devnet SOL balance. Try refreshing.", availableSol: null }, { status: 503 });
  }
}
