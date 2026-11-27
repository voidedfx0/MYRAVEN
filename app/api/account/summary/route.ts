import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Sign in to view your MYRAVEN account." }, { status: 401 });
  }

  const [profileResult, accountsResult, transactionsResult, entriesResult] = await Promise.all([
    supabase.from("profiles")
      .select("myraven_id,display_name,country_code,preferred_language,created_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("ledger_accounts")
      .select("id,account_code,asset_code,network_code,account_type,is_active")
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase.from("ledger_transactions")
      .select("id,source_type,source_reference,status,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("ledger_entries")
      .select("transaction_id,account_id,direction,amount,asset_code,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  const error = profileResult.error || accountsResult.error || transactionsResult.error || entriesResult.error;
  if (error) {
    return NextResponse.json({ error: "Account data is temporarily unavailable." }, { status: 503 });
  }

  const accounts = accountsResult.data ?? [];
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const balances = new Map<string, { asset: string; network: string; available: number; pending: number }>();

  for (const entry of entriesResult.data ?? []) {
    const account = accountById.get(entry.account_id);
    if (!account || !["available", "pending"].includes(account.account_type)) continue;
    const key = account.asset_code + ":" + account.network_code + ":" + account.account_type;
    const balance = balances.get(key) ?? {
      asset: account.asset_code,
      network: account.network_code,
      available: 0,
      pending: 0,
    };
    const signed = Number(entry.amount) * (entry.direction === "credit" ? 1 : -1);
    if (account.account_type === "available") balance.available += signed;
    if (account.account_type === "pending") balance.pending += signed;
    balances.set(key, balance);
  }

  const balanceRows = Array.from(balances.values()).filter((item) => item.available !== 0 || item.pending !== 0);

  return NextResponse.json({
    profile: profileResult.data,
    email: user.email ?? null,
    balances: balanceRows,
    transactions: transactionsResult.data ?? [],
    accountMode: "preview",
    moneyMovementEnabled: false,
    note: "Balances appear only after verified, server-posted ledger entries. No demo funds are credited.",
  });
}
