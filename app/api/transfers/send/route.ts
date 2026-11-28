import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PrivyClient } from "@privy-io/node";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RESERVE_LAMPORTS = 10_000;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in before sending SOL." }, { status: 401 });

  if (process.env.MYRAVEN_MODE !== "test" || (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase() !== "devnet") {
    return NextResponse.json({ error: "Transfers are locked unless MYRAVEN is explicitly configured for Solana Devnet test mode." }, { status: 409 });
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const authorizationPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  const quorumId = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !appSecret || !authorizationPrivateKey || !quorumId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Privy transfer authorization is not fully configured on the server." }, { status: 503 });
  }

  let body: { recipient?: string; amount?: string | number; idempotencyKey?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid transfer request." }, { status: 400 });
  }

  const identifier = String(body.recipient ?? "").trim().toUpperCase();
  const amountText = String(body.amount ?? "").trim();
  const idempotencyKey = String(body.idempotencyKey ?? "");
  if (!/^(?:[A-Z]{2,12}[0-9]{4}|[0-9]{10})$/.test(identifier)) {
    return NextResponse.json({ error: "Enter a valid MYRAVEN ID or 10-digit account number." }, { status: 400 });
  }
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,9})?$/.test(amountText) || Number(amountText) <= 0) {
    return NextResponse.json({ error: "Enter a SOL amount with up to 9 decimal places." }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "Transfer request ID is invalid. Please review and try again." }, { status: 400 });
  }

  const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: senderWallet, error: senderError } = await admin
    .from("user_solana_wallets")
    .select("wallet_address,status,network,custody_provider,provider_wallet_reference")
    .eq("user_id", user.id)
    .maybeSingle();

  if (senderError || !senderWallet?.wallet_address || senderWallet.status !== "provisioned" ||
      senderWallet.network !== "solana-devnet" || senderWallet.custody_provider !== "privy" ||
      !senderWallet.provider_wallet_reference || String(senderWallet.provider_wallet_reference).startsWith("pending:")) {
    return NextResponse.json({ error: "Your MYRAVEN Devnet wallet is not ready for sending." }, { status: 409 });
  }

  const { data: matches, error: lookupError } = await admin.rpc("lookup_myraven_recipient", { p_identifier: identifier });
  const recipient = Array.isArray(matches) ? record(matches[0]) : {};
  if (lookupError || !recipient.solana_address || recipient.wallet_status !== "provisioned") {
    return NextResponse.json({ error: "No transfer-ready MYRAVEN recipient matched those details." }, { status: 404 });
  }
  const destination = String(recipient.solana_address);
  if (!ADDRESS.test(destination)) return NextResponse.json({ error: "Recipient wallet address is invalid." }, { status: 409 });
  if (destination === senderWallet.wallet_address) return NextResponse.json({ error: "You cannot send SOL to your own MYRAVEN wallet." }, { status: 400 });

  const amount = Number(amountText);
  const lamports = Math.round(amount * 1_000_000_000);
  if (!Number.isSafeInteger(lamports) || lamports <= 0) return NextResponse.json({ error: "SOL amount is outside the supported precision." }, { status: 400 });

  try {
    const rpcResponse = await fetch(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "myraven-send-check", method: "getBalance", params: [senderWallet.wallet_address, { commitment: "confirmed" }] }),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const rpc = await rpcResponse.json();
    const balanceLamports = Number(rpc?.result?.value);
    if (!rpcResponse.ok || rpc?.error || !Number.isSafeInteger(balanceLamports)) {
      return NextResponse.json({ error: "Could not verify your live Devnet balance. No transfer was submitted." }, { status: 503 });
    }
    if (balanceLamports < lamports + RESERVE_LAMPORTS) {
      return NextResponse.json({ error: "Insufficient SOL. Keep at least 0.00001 SOL available for network fees." }, { status: 409 });
    }

    const privy = new PrivyClient({ appId, appSecret });
    const walletId = String(senderWallet.provider_wallet_reference);
    const walletResponse = await fetch("https://api.privy.io/v1/wallets/" + encodeURIComponent(walletId), {
      headers: { "privy-app-id": appId, Authorization: "Basic " + Buffer.from(appId + ":" + appSecret).toString("base64") },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const walletPayload = await walletResponse.json();
    if (!walletResponse.ok) {
      return NextResponse.json({ error: "Privy could not verify your existing wallet (HTTP " + walletResponse.status + "). No SOL was sent." }, { status: 502 });
    }
    const walletData = record(record(walletPayload).data);
    const providerWallet = record(record(walletPayload).wallet ?? walletData.wallet ?? walletData);
    const ownerId = providerWallet.owner_id == null ? null : String(providerWallet.owner_id);
    if (ownerId && ownerId !== quorumId) {
      return NextResponse.json({ error: "This existing wallet is owned by a different Privy authorization identity. It has not been changed and no SOL was sent." }, { status: 409 });
    }
    if (!ownerId) {
      try {
        await privy.wallets().update(walletId, {
          owner_id: quorumId,
          authorization_context: { authorization_private_keys: [authorizationPrivateKey] },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "authorization rejected";
        return NextResponse.json({ error: "Privy could not authorize this existing wallet for sending (" + message.slice(0, 180) + "). No SOL was sent." }, { status: 403 });
      }
    }

    const action = await privy.wallets().transfer(walletId, {
      source: { asset: "sol", chain: "solana_devnet" },
      amount: amountText,
      destination: { address: destination },
      reference_id: "myraven-" + idempotencyKey,
      idempotency_key: idempotencyKey,
      authorization_context: { authorization_private_keys: [authorizationPrivateKey] },
    });
    return NextResponse.json({
      actionId: action.id,
      status: action.status,
      type: "solana_devnet_transfer",
      amount: amountText,
      asset: "SOL",
      destination,
      recipient: String(recipient.display_name ?? recipient.myraven_id ?? identifier),
      network: "solana-devnet",
      message: action.status === "succeeded" ? "Transfer confirmed by Privy." : "Transfer submitted to Privy. Waiting for on-chain confirmation.",
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Privy transfer failed.";
    return NextResponse.json({ error: "Transfer could not be submitted: " + message.slice(0, 220) + ". No success has been recorded." }, { status: 502 });
  }
}
