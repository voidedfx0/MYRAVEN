import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to view your MYRAVEN account." }, { status: 401 });
  }

  const [profileResult, balancesResult, transactionsResult, walletResult] = await Promise.all([
    supabase.from("profiles")
      .select("myraven_id,account_number,display_name,first_name,last_name,country_code,preferred_language,account_type,created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("ledger_account_balances")
      .select("account_id,asset_code,network_code,account_type,balance")
      .eq("user_id", user.id),
    supabase.from("ledger_transactions")
      .select("id,source_type,source_reference,status,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("user_solana_wallets")
      .select("wallet_address,status,network,custody_provider")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const error = profileResult.error || balancesResult.error || transactionsResult.error || walletResult.error;
  if (error) {
    return NextResponse.json({ error: "Account data is temporarily unavailable." }, { status: 503 });
  }

  const balances = balancesResult.data ?? [];

  return NextResponse.json({
    profile: profileResult.data,
    email: user.email ?? null,
    balances,
    solanaWallet: walletResult.data,
    transactions: transactionsResult.data ?? [],
    accountMode: "preview",
    moneyMovementEnabled: false,
    note: "Balances appear only after verified, server-posted ledger entries. No demo funds are credited.",
  });
}
