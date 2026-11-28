import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PrivyClient } from "@privy-io/node";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in to check this transfer." }, { status: 401 });

  const actionId = new URL(request.url).searchParams.get("actionId") ?? "";
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(actionId)) return NextResponse.json({ error: "Invalid transfer reference." }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !appSecret || !url || !serviceKey) return NextResponse.json({ error: "Transfer status service is not configured." }, { status: 503 });

  const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: wallet, error: walletError } = await admin.from("user_solana_wallets")
    .select("provider_wallet_reference,wallet_address,status,network,custody_provider")
    .eq("user_id", user.id).maybeSingle();
  if (walletError || !wallet?.provider_wallet_reference || wallet.status !== "provisioned" ||
      wallet.network !== "solana-devnet" || wallet.custody_provider !== "privy") {
    return NextResponse.json({ error: "Your Devnet wallet could not be verified." }, { status: 409 });
  }

  try {
    const privy = new PrivyClient({ appId, appSecret });
    const result = await privy.wallets().actions.get(actionId, {
      wallet_id: String(wallet.provider_wallet_reference),
      include: "steps",
    });
    const root = record(result);
    const data = record(root.data);
    const action = record(root.action ?? data.action ?? data ?? root);
    const status = String(action.status ?? "pending").toLowerCase();
    if (["succeeded", "failed", "cancelled", "reverted"].includes(status)) {
      const { data: activityRows } = await admin.from("ledger_transactions")
        .select("id,user_id,description,status")
        .eq("source_reference", actionId)
        .eq("source_type", "transfer");
      if (activityRows?.length) {
        const finalLedgerStatus = status === "succeeded" ? "posted" : "failed";
        await admin.from("ledger_transactions").update({ status: finalLedgerStatus }).eq("source_reference", actionId).eq("source_type", "transfer");
        if (status === "succeeded") {
          for (const row of activityRows) {
            const { data: existing } = await admin.from("notifications").select("id")
              .eq("user_id", row.user_id).contains("data", { action_id: actionId }).limit(1);
            if (!existing?.length) {
              const isSender = String(row.description ?? "").startsWith("Sent ");
              await admin.from("notifications").insert({
                user_id: row.user_id,
                category: "payment",
                title: isSender ? "SOL sent successfully" : "You received SOL 🎉",
                body: isSender ? String(row.description) + ". Your SOL has left your wallet and is on its way." : String(row.description) + ". It has landed in your MYRAVEN wallet.",
                data: { action_id: actionId, type: isSender ? "sent" : "received", asset: "SOL", network: "solana-devnet" },
              });
            }
          }
        }
      }
    }
    return NextResponse.json({
      actionId,
      status,
      sourceAmount: action.source_amount ?? null,
      destinationAddress: action.destination_address ?? null,
      steps: Array.isArray(action.steps) ? action.steps : [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (issue) {
    const message = issue instanceof Error ? issue.message : "Could not load transfer status.";
    return NextResponse.json({ error: message.slice(0, 180) }, { status: 502 });
  }
}
