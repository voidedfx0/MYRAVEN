import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PrivyClient } from "@privy-io/node";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

async function reconcilePendingTransfers(admin: unknown, currentUserId: string) {
  // The service-role client is dynamically typed because this project has no generated Database type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = admin as any;
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId || !appSecret) return;

  const privy = new PrivyClient({ appId, appSecret });
  const { data: pendingData } = await adminDb.from("ledger_transactions")
    .select("user_id,source_reference,description")
    .eq("user_id", currentUserId)
    .eq("source_type", "transfer")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(3);
  const pendingRows = (pendingData ?? []) as Array<{ user_id: string; source_reference: string | null; description: string | null }>;

  for (const pending of pendingRows) {
    const actionId = String(pending.source_reference ?? "");
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(actionId)) continue;

    const { data: pairData } = await adminDb.from("ledger_transactions")
      .select("user_id,description")
      .eq("source_type", "transfer")
      .eq("source_reference", actionId);
    const pairRows = (pairData ?? []) as Array<{ user_id: string; description: string | null }>;
    const senderRow = pairRows.find((row) => String(row.description ?? "").startsWith("Sent "));
    if (!senderRow) continue;

    const { data: senderWalletData } = await adminDb.from("user_solana_wallets")
      .select("provider_wallet_reference,status,network,custody_provider")
      .eq("user_id", senderRow.user_id)
      .maybeSingle();
    const senderWallet = senderWalletData as { provider_wallet_reference: string | null; status: string; network: string; custody_provider: string | null } | null;
    if (!senderWallet?.provider_wallet_reference || senderWallet.status !== "provisioned" ||
        senderWallet.network !== "solana-devnet" || senderWallet.custody_provider !== "privy") continue;

    try {
      const result = await privy.wallets().actions.get(actionId, {
        wallet_id: String(senderWallet.provider_wallet_reference),
        include: "steps",
      });
      const root = record(result);
      const data = record(root.data);
      const action = record(root.action ?? data.action ?? data ?? root);
      const status = String(action.status ?? "pending").toLowerCase();

      if (status === "succeeded") {
        await adminDb.from("ledger_transactions").update({ status: "posted" })
          .eq("source_type", "transfer").eq("source_reference", actionId);
        for (const row of pairRows) {
          const { data: existing } = await adminDb.from("notifications").select("id")
            .eq("user_id", row.user_id).contains("data", { action_id: actionId }).limit(1);
          if (existing?.length) continue;
          const isSender = String(row.description ?? "").startsWith("Sent ");
          const { error: insertError } = await adminDb.from("notifications").insert({
            user_id: row.user_id,
            category: "payment",
            title: isSender ? "SOL sent successfully" : "You received SOL 🎉",
            body: isSender
              ? String(row.description) + ". Your SOL has left your wallet."
              : String(row.description) + ". It has landed in your MYRAVEN wallet.",
            data: { action_id: actionId, type: isSender ? "sent" : "received", asset: "SOL", network: "solana-devnet" },
          });
          if (insertError) console.error("[MYRAVEN notifications] Could not create transfer alert", insertError.message);
        }
      } else if (["failed", "rejected", "cancelled", "reverted"].includes(status)) {
        await adminDb.from("ledger_transactions").update({ status: "failed" })
          .eq("source_type", "transfer").eq("source_reference", actionId);
      }
    } catch (error) {
      console.warn("[MYRAVEN notifications] Transfer status check will retry", actionId,
        error instanceof Error ? error.message.slice(0, 120) : "status unavailable");
    }
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ notifications: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    const admin = createSupabaseAdmin(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    await reconcilePendingTransfers(admin, user.id);
  }

  const { data, error } = await supabase.from("notifications")
    .select("id,title,body,category,data,created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });

  return NextResponse.json({ notifications: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
