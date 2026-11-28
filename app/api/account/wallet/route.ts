import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

type PrivyWalletRecord = Record<string, unknown>;

function asRecord(value: unknown): PrivyWalletRecord {
  return typeof value === "object" && value !== null
    ? value as PrivyWalletRecord
    : {};
}

function getWallet(data: unknown): PrivyWalletRecord {
  const root = asRecord(data);
  const nested = asRecord(root.data);
  return asRecord(root.wallet ?? nested.wallet ?? root.data ?? root);
}

async function privyRequest(path: string, method: "GET" | "POST" | "PATCH", appId: string, appSecret: string, body?: unknown, idempotencyKey?: string) {
  return fetch("https://api.privy.io/v1" + path, {
    method,
    headers: {
      "privy-app-id": appId,
      Authorization: "Basic " + Buffer.from(appId + ":" + appSecret).toString("base64"),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(idempotencyKey ? { "privy-idempotency-key": idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to create your MYRAVEN wallet." }, { status: 401 });
  }

  if (process.env.MYRAVEN_MODE !== "test" || (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase() !== "devnet") {
    return NextResponse.json({ error: "Wallet provisioning is restricted to the MYRAVEN Solana Devnet test environment." }, { status: 409 });
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !appSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Privy or Supabase server configuration is incomplete." }, { status: 503 });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingError } = await admin
    .from("user_solana_wallets")
    .select("wallet_address,status,provider_wallet_reference,network")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "Your wallet record could not be loaded." }, { status: 503 });
  }
  const keyQuorumId = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;
  if (!keyQuorumId) {
    return NextResponse.json({ error: "Privy wallet ownership is not configured. Add the MYRAVEN key quorum ID in Vercel and redeploy." }, { status: 503 });
  }

  if (existing?.wallet_address && existing.status === "provisioned" && existing.network === "solana-devnet") {
    const walletId = existing.provider_wallet_reference;
    if (!walletId || walletId.startsWith("pending:")) {
      return NextResponse.json({ error: "Your existing Privy wallet reference is incomplete. Contact MYRAVEN support." }, { status: 503 });
    }
    try {
      const walletLookup = await privyRequest("/wallets/" + encodeURIComponent(walletId), "GET", appId, appSecret);
      if (!walletLookup.ok) {
        return NextResponse.json({ error: `Existing Privy wallet could not be verified (HTTP ${walletLookup.status}).` }, { status: 502 });
      }
      const walletDetails = asRecord(await walletLookup.json());
      const currentOwnerId = typeof walletDetails.owner_id === "string" ? walletDetails.owner_id : null;
      if (currentOwnerId && currentOwnerId !== keyQuorumId) {
        return NextResponse.json({ error: "This wallet is already assigned to a different Privy owner. It was left unchanged." }, { status: 409 });
      }
      if (!currentOwnerId) {
        const ownerUpdate = await privyRequest("/wallets/" + encodeURIComponent(walletId), "PATCH", appId, appSecret, { owner_id: keyQuorumId });
        if (!ownerUpdate.ok) {
          return NextResponse.json({ error: `Privy could not attach the MYRAVEN authorization quorum (HTTP ${ownerUpdate.status}). Existing wallet and funds are unchanged.` }, { status: 502 });
        }
      }
      return NextResponse.json({ address: existing.wallet_address, status: "provisioned", network: "devnet", reused: true, authorization: "quorum_attached" });
    } catch {
      return NextResponse.json({ error: "The existing Privy wallet could not be updated. Your wallet and funds are unchanged." }, { status: 502 });
    }
  }

  const externalId = "myraven-" + user.id;
  const idempotencyKey = externalId;

  const { data: profile } = await admin
    .from("profiles")
    .select("myraven_id")
    .eq("id", user.id)
    .maybeSingle();

  const { error: pendingSaveError } = await admin.from("user_solana_wallets").upsert({
    user_id: user.id,
    network: "solana-devnet",
    wallet_address: null,
    custody_provider: "privy",
    provider_wallet_reference: "pending:" + externalId,
    status: "awaiting_provider",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (pendingSaveError) {
    return NextResponse.json({ error: "Your wallet setup could not be prepared. Please retry." }, { status: 503 });
  }

  let providerWallet: PrivyWalletRecord | null = null;
  try {
    // Recover by immutable external ID first. This prevents duplicate wallets if
    // Privy created one but a previous request failed before saving it to Supabase.
    const lookup = await privyRequest("/wallets/ext_wal_" + externalId, "GET", appId, appSecret);
    if (lookup.ok) {
      providerWallet = getWallet(await lookup.json());
    } else if (lookup.status !== 404) {
      return NextResponse.json({ error: `Privy wallet lookup failed (HTTP ${lookup.status}). Check the Privy app credentials and wallet API permissions.` }, { status: 502 });
    }

    if (!providerWallet) {
      const created = await privyRequest("/wallets", "POST", appId, appSecret, {
        chain_type: "solana",
        display_name: "MYRAVEN " + (profile?.myraven_id ?? "Wallet"),
        external_id: externalId,
        owner_id: keyQuorumId,
      }, idempotencyKey);
      const payload = await created.json().catch(() => ({}));
      if (!created.ok) {
        return NextResponse.json({
          error: created.status === 401 || created.status === 403
            ? "Privy rejected the app credentials or wallet permissions. Check the Privy app configuration."
            : "Privy could not create your Solana wallet. Please retry.",
        }, { status: 502 });
      }
      providerWallet = getWallet(payload);
    }
  } catch {
    return NextResponse.json({ error: "The wallet provider could not be reached. Retry in a moment." }, { status: 502 });
  }

  const address = String(providerWallet.address ?? providerWallet.public_key ?? providerWallet.publicKey ?? "");
  const walletId = String(providerWallet.id ?? providerWallet.wallet_id ?? providerWallet.walletId ?? "");
  if (!walletId || !SOLANA_ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: "Privy returned an incomplete Solana wallet record. No address was activated." }, { status: 502 });
  }

  const { error: saveError } = await admin.from("user_solana_wallets").upsert({
    user_id: user.id,
    network: "solana-devnet",
    wallet_address: address,
    custody_provider: "privy",
    provider_wallet_reference: walletId,
    status: "provisioned",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (saveError) {
    return NextResponse.json({ error: "Privy created your wallet, but MYRAVEN could not save its account link. Your wallet will be recovered safely on retry." }, { status: 503 });
  }

  return NextResponse.json({ address, status: "provisioned", network: "devnet", reused: false });
}
