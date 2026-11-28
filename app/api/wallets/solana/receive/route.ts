import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to view your MYRAVEN receiving wallet." }, { status: 401 });
  }

  // Wallet records are provisioned server-side through Privy. Never create a
  // client-side placeholder or silently switch this account to mainnet.
  const { data: wallet, error } = await supabase
    .from("user_solana_wallets")
    .select("network,wallet_address,status,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Your wallet profile is temporarily unavailable." }, { status: 503 });
  }

  const addressReady = wallet?.network === "solana-devnet" &&
    wallet.status === "provisioned" && Boolean(wallet.wallet_address);

  return NextResponse.json({
    wallet: wallet ?? { network: "solana-devnet", wallet_address: null, status: "awaiting_provider" },
    addressReady,
    canReceive: addressReady,
    note: addressReady
      ? "This is your personal Solana Devnet address. Only send test SOL on Devnet."
      : "Your personal Devnet wallet has not been provisioned yet. Open Account details to retry setup.",
  }, { headers: { "Cache-Control": "no-store" } });
}
