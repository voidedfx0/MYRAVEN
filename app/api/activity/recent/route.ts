import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatAmount(value: number | string, currency: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value) + " " + currency;
  return amount.toLocaleString("en-US", { maximumFractionDigits: 8 }) + " " + currency;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view activity." }, { status: 401 });

  const [transactionsResult, depositsResult] = await Promise.all([
    supabase.from("ledger_transactions")
      .select("id,source_type,source_reference,status,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("funding_deposits")
      .select("id,input_currency,input_amount,target_asset,credited_output_amount,status,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (transactionsResult.error || depositsResult.error) {
    return NextResponse.json({ error: "Recent activity is temporarily unavailable." }, { status: 503 });
  }

  const transfers = (transactionsResult.data ?? []).map((item) => {
    const description = item.description ?? "MYRAVEN transfer";
    const sent = description.startsWith("Sent ");
    const received = description.startsWith("Received ");
    const status = item.status === "posted" ? "Successful" : item.status === "failed" ? "Failed" : "Pending";
    const amountMatch = description.match(/(?:Sent|Received)\\s+([0-9]+(?:\\.[0-9]+)?\\s+[A-Z]+)/i);
    return {
      id: String(item.id),
      title: sent ? "Sent" : received ? "Received" : "Payment",
      detail: description,
      amount: amountMatch ? amountMatch[1] : "",
      status,
      category: item.status === "pending" ? "Pending" : sent ? "Sent" : received ? "Received" : "Pending",
      createdAt: item.created_at,
      time: new Date(item.created_at).toLocaleString(),
      reference: item.source_reference,
    };
  });

  const funding = (depositsResult.data ?? []).map((item) => {
    const credited = item.status === "credited" && item.credited_output_amount != null;
    const failed = ["failed", "cancelled", "expired", "recovery_pending"].includes(item.status);
    return {
      id: "fund-" + String(item.id),
      title: "Wallet funding",
      detail: formatAmount(item.input_amount, item.input_currency) + " payment · " + item.target_asset,
      amount: credited ? "+" + formatAmount(item.credited_output_amount as number | string, item.target_asset) : formatAmount(item.input_amount, item.input_currency),
      status: credited ? "Successful · " + formatAmount(item.credited_output_amount as number | string, item.target_asset) + " credited" : failed ? item.status.replaceAll("_", " ") : item.status === "awaiting_payment" ? "Awaiting payment" : "Conversion pending",
      category: failed ? "Fund" : credited ? "Fund" : "Pending",
      createdAt: item.created_at,
      time: new Date(item.created_at).toLocaleString(),
    };
  });

  const activities = [...transfers, ...funding]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  return NextResponse.json({ activities }, { headers: { "Cache-Control": "no-store" } });
}
