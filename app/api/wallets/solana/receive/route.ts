import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to view your MYRAVEN receiving wallet." }, { status: 401 });
  }

  // Create only a per-user placeholder. The client is deliberately unable to
  // assign an address, custody provider, or provider wallet reference.
  const { error: createError } = await supabase
    .from("user_solana_wallets")
    .upsert(
      { user_id: user.id, network: "solana-mainnet", status: "awaiting_provider" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );

  if (createError) {
    return NextResponse.json({ error: "Your wallet profile could not be initialized yet." }, { status: 503 });
  }

  const { data: wallet, error } = await supabase
    .from("user_solana_wallets")
    .select("network,wallet_address,status,created_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !wallet) {
    return NextResponse.json({ error: "Your wallet profile is temporarily unavailable." }, { status: 503 });
  }

  return NextResponse.json({
    wallet,
    addressReady: wallet.status === "provisioned" && Boolean(wallet.wallet_address),
    canReceive: false,
    note: wallet.wallet_address
      ? "Address is assigned, but deposits remain disabled until custody and deposit monitoring are approved."
      : "A unique address will be assigned by the MYRAVEN custody provider. No shared or placeholder address is displayed.",
  }, { headers: { "Cache-Control": "no-store" } });
}
