import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PrivyClient } from "@privy-io/node";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const RESERVE_LAMPORTS = 10_000;
const TREASURY_EXTERNAL_ID = "myraven-treasury-solana-devnet-v1";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  typeof value === "object" && value !== null ? value as RecordValue : {};

async function rpc(method: string, params: unknown[]) {
  const response = await fetch(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "myraven-funding-settlement", method, params }),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.error) throw new Error("Solana Devnet RPC request failed.");
  return payload?.result;
}

async function getBalance(address: string) {
  const result = await rpc("getBalance", [address, { commitment: "confirmed" }]);
  const lamports = Number(result?.value);
  if (!Number.isSafeInteger(lamports) || lamports < 0) throw new Error("Could not verify the live Devnet balance.");
  return lamports;
}

async function getPriceAndFx(currency: string) {
  const [priceResponse, fxResponse] = await Promise.all([
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", { cache: "no-store" }),
    currency === "USD" ? Promise.resolve(null) : fetch("https://open.er-api.com/v6/latest/" + encodeURIComponent(currency), { cache: "no-store" }),
  ]);
  const priceData = await priceResponse.json().catch(() => null);
  const solPriceUsd = Number(priceData?.solana?.usd);
  if (!priceResponse.ok || !Number.isFinite(solPriceUsd) || solPriceUsd <= 0) throw new Error("Live SOL price is unavailable.");
  let fiatUsdRate = 1;
  if (currency !== "USD") {
    const fxData = await fxResponse!.json().catch(() => null);
    fiatUsdRate = Number(fxData?.rates?.USD);
    if (!fxResponse!.ok || fxData?.result !== "success" || !Number.isFinite(fiatUsdRate) || fiatUsdRate <= 0) {
      throw new Error("Live " + currency + " exchange rate is unavailable.");
    }
  }
  return { solPriceUsd, fiatUsdRate };
}

async function ensureTreasury(adminInput: unknown, appId: string, appSecret: string, quorumId: string) {
  const admin = adminInput as ReturnType<typeof createSupabaseAdmin>;
  // The generated Supabase client types do not yet include this existing private table.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treasuryTable = admin.from("myraven_treasury_wallets") as any;
  const { data: existing, error } = await treasuryTable
    .select("wallet_address,provider_wallet_reference,status,network")
    .eq("network", "solana-devnet").maybeSingle();
  if (error) throw new Error("Could not load the MYRAVEN treasury record.");
  const existingRow = existing as unknown as { wallet_address: string; provider_wallet_reference: string; status: string; network: string } | null;
  if (existingRow?.wallet_address && existingRow.provider_wallet_reference && existingRow.status === "provisioned") return existingRow;

  const headers = {
    "privy-app-id": appId,
    Authorization: "Basic " + Buffer.from(appId + ":" + appSecret).toString("base64"),
    "Content-Type": "application/json",
  };
  const lookup = await fetch("https://api.privy.io/v1/wallets/ext_wal_" + TREASURY_EXTERNAL_ID, {
    headers, cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  let payload: unknown = null;
  if (lookup.ok) {
    payload = await lookup.json().catch(() => null);
  } else if (lookup.status === 404) {
    const response = await fetch("https://api.privy.io/v1/wallets", {
      method: "POST",
      headers: { ...headers, "privy-idempotency-key": TREASURY_EXTERNAL_ID },
      body: JSON.stringify({
        chain_type: "solana",
        display_name: "MYRAVEN Treasury · Devnet",
        external_id: TREASURY_EXTERNAL_ID,
        owner_id: quorumId,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error("Privy could not create the MYRAVEN treasury (HTTP " + response.status + ").");
  } else {
    throw new Error("Privy could not look up the MYRAVEN treasury (HTTP " + lookup.status + ").");
  }
  const root = record(payload);
  const data = record(root.data);
  const wallet = record(root.wallet ?? data.wallet ?? root.data ?? root);
  const address = String(wallet.address ?? wallet.public_key ?? wallet.publicKey ?? "");
  const walletId = String(wallet.id ?? wallet.wallet_id ?? wallet.walletId ?? "");
  if (!walletId || !ADDRESS.test(address)) throw new Error("Privy returned an incomplete treasury wallet.");

  const { error: saveError } = await treasuryTable.upsert({
    network: "solana-devnet",
    custody_provider: "privy",
    wallet_address: address,
    provider_wallet_reference: walletId,
    status: "provisioned",
    updated_at: new Date().toISOString(),
  }, { onConflict: "network", ignoreDuplicates: true });
  if (saveError) throw new Error("Treasury was created but its database record could not be saved.");

  const { data: saved, error: reloadError } = await treasuryTable
    .select("wallet_address,provider_wallet_reference,status,network")
    .eq("network", "solana-devnet").single();
  const savedRow = saved as unknown as { wallet_address: string; provider_wallet_reference: string; status: string; network: string } | null;
  if (reloadError || !savedRow) throw new Error("Treasury setup is still being reconciled. Retry shortly.");
  return savedRow;
}

async function requestTreasuryLiquidity(address: string, requiredLamports: number) {
  let balance = await getBalance(address);
  if (balance >= requiredLamports + RESERVE_LAMPORTS) return balance;

  // This is a one-time-style test treasury refill, never a customer-wallet faucet.
  const faucetResponse = await fetch("https://api.devnet.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "myraven-treasury-seed", method: "requestAirdrop", params: [address, 1_000_000_000, { commitment: "confirmed" }] }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const faucetPayload = await faucetResponse.json().catch(() => null);
  const signature = faucetPayload?.result;
  if (!faucetResponse.ok || faucetPayload?.error || typeof signature !== "string" || signature.length < 40) {
    throw new Error("The public Solana Devnet faucet could not seed the MYRAVEN test treasury.");
  }
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const statuses = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
    const status = statuses?.value?.[0];
    if (status?.err) throw new Error("The treasury Devnet seed transaction failed.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  balance = await getBalance(address);
  if (balance < requiredLamports + RESERVE_LAMPORTS) throw new Error("The MYRAVEN test treasury does not have enough Devnet SOL yet.");
  return balance;
}

function findSignature(value: unknown, depth = 0): string | null {
  if (depth > 7 || value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const item of value) { const found = findSignature(item, depth + 1); if (found) return found; }
    return null;
  }
  if (typeof value !== "object") return null;
  const obj = value as RecordValue;
  for (const key of ["signature", "transaction_signature", "transactionSignature", "transaction_hash", "transactionHash"]) {
    const candidate = obj[key];
    if (typeof candidate === "string" && /^[1-9A-HJ-NP-Za-km-z]{80,100}$/.test(candidate)) return candidate;
  }
  for (const child of Object.values(obj)) { const found = findSignature(child, depth + 1); if (found) return found; }
  return null;
}

export async function POST(request: Request) {
  if (process.env.MYRAVEN_MODE !== "test" || (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase() !== "devnet") {
    return NextResponse.json({ error: "Treasury settlement is restricted to Solana Devnet test mode." }, { status: 403 });
  }

  const auth = await createClient();
  const { data: { user }, error: authError } = await auth.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to settle this funding request." }, { status: 401 });

  let body: { deposit_id?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid settlement request." }, { status: 400 }); }
  const depositId = String(body.deposit_id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(depositId)) return NextResponse.json({ error: "Invalid funding reference." }, { status: 400 });

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const authorizationPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;
  const quorumId = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !appSecret || !authorizationPrivateKey || !quorumId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Treasury settlement is not fully configured on the server." }, { status: 503 });
  }

  const admin = createSupabaseAdmin(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: deposit, error: depositError } = await admin.from("funding_deposits")
    .select("id,user_id,status,input_amount,input_currency,target_asset,credited_output_amount,metadata")
    .eq("id", depositId).eq("user_id", user.id).eq("provider_code", "flutterwave").maybeSingle();
  if (depositError || !deposit) return NextResponse.json({ error: "Funding request not found." }, { status: 404 });
  if (deposit.status === "credited" && Number(deposit.credited_output_amount) > 0) {
    return NextResponse.json({ status: "credited", amount: deposit.credited_output_amount, already_credited: true });
  }
  if (deposit.status !== "converting" || deposit.metadata?.payment_state !== "successful" || deposit.metadata?.environment !== "test") {
    return NextResponse.json({ error: "Only a verified successful Flutterwave test payment can be settled." }, { status: 409 });
  }
  if (String(deposit.target_asset).toUpperCase() !== "SOL") {
    return NextResponse.json({ error: "Devnet treasury settlement currently supports SOL funding only." }, { status: 409 });
  }

  const { data: customerWallet, error: customerError } = await admin.from("user_solana_wallets")
    .select("wallet_address,provider_wallet_reference,status,network,custody_provider")
    .eq("user_id", user.id).maybeSingle();
  if (customerError || !customerWallet?.wallet_address || !customerWallet.provider_wallet_reference ||
      customerWallet.status !== "provisioned" || customerWallet.network !== "solana-devnet" || customerWallet.custody_provider !== "privy") {
    return NextResponse.json({ error: "Your MYRAVEN Solana wallet is not ready to receive this funding." }, { status: 409 });
  }

  try {
    const prior = record(deposit.metadata?.treasury_settlement);
    const fiatAmount = Number(deposit.metadata?.verified_amount ?? deposit.input_amount);
    let solPriceUsd = Number(prior.sol_price_usd) || 0;
    let fiatUsdRate = Number(prior.fiat_usd_rate) || 0;
    if (!solPriceUsd || !fiatUsdRate) {
      const rates = await getPriceAndFx(String(deposit.metadata?.verified_currency ?? deposit.input_currency).toUpperCase());
      solPriceUsd = rates.solPriceUsd;
      fiatUsdRate = rates.fiatUsdRate;
    }
    const solAmount = Number(prior.sol_amount) || Number(((fiatAmount * fiatUsdRate) / solPriceUsd).toFixed(8));
    if (!Number.isFinite(fiatAmount) || fiatAmount <= 0 || !Number.isFinite(solAmount) || solAmount <= 0) {
      return NextResponse.json({ error: "The verified payment could not be converted to a valid SOL amount." }, { status: 409 });
    }
    const lamports = Math.round(solAmount * 1_000_000_000);
    if (!Number.isSafeInteger(lamports) || lamports <= 0) return NextResponse.json({ error: "The SOL conversion amount is outside supported precision." }, { status: 409 });

    const treasury = await ensureTreasury(admin, appId, appSecret, quorumId);
    const treasuryAddress = String(treasury.wallet_address);
    const treasuryWalletId = String(treasury.provider_wallet_reference);
    const privy = new PrivyClient({ appId, appSecret });

    let actionId = typeof prior.action_id === "string" ? prior.action_id : "";
    let actionStatus = "pending";
    let action: RecordValue = {};
    let destinationBalanceBeforeLamports = Number(prior.destination_balance_before_lamports);
    if (!actionId) {
      await requestTreasuryLiquidity(treasuryAddress, lamports);
      destinationBalanceBeforeLamports = await getBalance(String(customerWallet.wallet_address));
    }
    if (actionId) {
      const current = await privy.wallets().actions.get(actionId, { wallet_id: treasuryWalletId, include: "steps" });
      const root = record(current);
      const data = record(root.data);
      action = record(root.action ?? data.action ?? data ?? root);
      actionStatus = String(action.status ?? "pending").toLowerCase();
    } else {
      const submitted = await privy.wallets().transfer(treasuryWalletId, {
        source: { asset: "sol", chain: "solana_devnet" },
        amount: solAmount.toFixed(8),
        destination: { address: String(customerWallet.wallet_address) },
        reference_id: "myraven-funding-" + deposit.id,
        idempotency_key: "myraven-funding-" + deposit.id,
        authorization_context: { authorization_private_keys: [authorizationPrivateKey] },
      });
      actionId = String(submitted.id ?? "");
      actionStatus = String(submitted.status ?? "pending").toLowerCase();
      action = record(submitted);
      if (!actionId) throw new Error("Privy did not return a treasury transfer reference.");
      const settlement = {
        mode: "devnet_treasury",
        provider: "MYRAVEN Privy treasury",
        network: "solana-devnet",
        treasury_address: treasuryAddress,
        destination_address: customerWallet.wallet_address,
        fiat_amount: fiatAmount,
        fiat_currency: deposit.metadata?.verified_currency ?? deposit.input_currency,
        fiat_usd_rate: fiatUsdRate,
        sol_price_usd: solPriceUsd,
        sol_amount: solAmount,
        action_id: actionId,
        destination_balance_before_lamports: destinationBalanceBeforeLamports,
        transfer_status: actionStatus,
        wallet_credited: false,
        created_at: new Date().toISOString(),
      };
      const { error: savePendingError } = await admin.from("funding_deposits")
        .update({ metadata: { ...(deposit.metadata ?? {}), treasury_settlement: settlement } })
        .eq("id", deposit.id).eq("user_id", user.id).eq("status", "converting");
      if (savePendingError) throw new Error("Transfer was submitted but its status could not be saved. Refresh funding activity to reconcile it.");
    }

    if (["failed", "cancelled", "canceled", "reverted"].includes(actionStatus)) {
      await admin.from("funding_deposits").update({
        status: "recovery_pending",
        failure_code: "treasury_transfer_failed",
        metadata: { ...(deposit.metadata ?? {}), treasury_settlement: { ...prior, action_id: actionId, transfer_status: actionStatus, wallet_credited: false, failed_at: new Date().toISOString() } },
      }).eq("id", deposit.id).eq("user_id", user.id).eq("status", "converting");
      return NextResponse.json({ status: "recovery_pending", error: "The payment was verified, but the treasury transfer failed. Funds were not marked as available." }, { status: 409 });
    }

    if (!["succeeded", "success", "confirmed"].includes(actionStatus)) {
      const pending = {
        ...prior,
        mode: "devnet_treasury",
        provider: "MYRAVEN Privy treasury",
        network: "solana-devnet",
        treasury_address: treasuryAddress,
        destination_address: customerWallet.wallet_address,
        fiat_amount: fiatAmount,
        fiat_currency: deposit.metadata?.verified_currency ?? deposit.input_currency,
        fiat_usd_rate: fiatUsdRate,
        sol_price_usd: solPriceUsd,
        sol_amount: solAmount,
        action_id: actionId,
        destination_balance_before_lamports: destinationBalanceBeforeLamports,
        transfer_status: actionStatus,
        wallet_credited: false,
        updated_at: new Date().toISOString(),
      };
      await admin.from("funding_deposits").update({ metadata: { ...(deposit.metadata ?? {}), treasury_settlement: pending } }).eq("id", deposit.id).eq("user_id", user.id);
      return NextResponse.json({ status: "settlement_pending", actionId, solAmount, message: "Treasury transfer submitted. Waiting for Solana confirmation." }, { status: 202 });
    }

    const signature = findSignature(action);
    if (signature) {
      const statuses = await rpc("getSignatureStatuses", [[signature], { searchTransactionHistory: true }]);
      const signatureStatus = statuses?.value?.[0];
      if (signatureStatus?.err) throw new Error("The treasury transfer failed on Solana.");
      if (!signatureStatus || !["confirmed", "finalized"].includes(String(signatureStatus.confirmationStatus))) {
        return NextResponse.json({ status: "settlement_pending", actionId, solAmount, message: "Privy completed the action; waiting for Solana confirmation." }, { status: 202 });
      }
    }

    const destinationBalance = await getBalance(String(customerWallet.wallet_address));
    const before = destinationBalanceBeforeLamports;
    if (Number.isSafeInteger(before) && destinationBalance < before + lamports) {
      return NextResponse.json({ status: "settlement_pending", actionId, solAmount, message: "Transfer is processing; the receiving wallet balance has not updated yet." }, { status: 202 });
    }

    const completed = {
      ...prior,
      mode: "devnet_treasury",
      provider: "MYRAVEN Privy treasury",
      network: "solana-devnet",
      treasury_address: treasuryAddress,
      destination_address: customerWallet.wallet_address,
      fiat_amount: fiatAmount,
      fiat_currency: deposit.metadata?.verified_currency ?? deposit.input_currency,
      fiat_usd_rate: fiatUsdRate,
      sol_price_usd: solPriceUsd,
      sol_amount: solAmount,
      action_id: actionId,
      blockchain_signature: signature,
      transfer_status: "confirmed",
      conversion_status: "confirmed",
      wallet_credited: true,
      completed_at: new Date().toISOString(),
    };
    const { error: completeError } = await admin.from("funding_deposits").update({
      status: "credited",
      credited_output_amount: solAmount,
      blockchain_signature: signature,
      failure_code: null,
      metadata: { ...(deposit.metadata ?? {}), treasury_settlement: completed },
    }).eq("id", deposit.id).eq("user_id", user.id).eq("status", "converting");
    if (completeError) throw new Error("On-chain transfer confirmed but the funding record could not be finalized. Refresh activity to reconcile.");
    return NextResponse.json({ status: "credited", solAmount, signature, destinationBalanceSol: destinationBalance / 1_000_000_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Treasury settlement failed.";
    return NextResponse.json({ error: message.slice(0, 240), status: "settlement_error" }, { status: 502 });
  }
}
