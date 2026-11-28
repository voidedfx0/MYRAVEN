import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function POST() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to create your MYRAVEN wallet." }, { status: 401 });
  }

  if (process.env.MYRAVEN_MODE !== "test" || process.env.SOLANA_NETWORK !== "devnet") {
    return NextResponse.json({ error: "Wallet provisioning is restricted to the MYRAVEN Devnet test environment." }, { status: 409 });
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !appSecret || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Wallet provider setup is incomplete. MYRAVEN ID and account number are ready." }, { status: 503 });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingError } = await admin
    .from("user_solana_wallets")
    .select("wallet_address,status,provider_wallet_reference")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "Your wallet record could not be loaded." }, { status: 503 });
  }
  if (existing?.wallet_address && existing.status === "provisioned") {
    return NextResponse.json({ address: existing.wallet_address, status: "provisioned", reused: true });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("myraven_id")
    .eq("id", user.id)
    .maybeSingle();

  const idempotencyKey = existing?.provider_wallet_reference?.startsWith("pending:")
    ? existing.provider_wallet_reference.slice("pending:".length)
    : "myraven-" + user.id + "-" + crypto.randomUUID();

  const { error: pendingSaveError } = await admin.from("user_solana_wallets").upsert({
    user_id: user.id,
    network: "solana-devnet",
    wallet_address: null,
    custody_provider: null,
    provider_wallet_reference: "pending:" + idempotencyKey,
    status: "awaiting_provider",
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

  if (pendingSaveError) {
    return NextResponse.json({ error: "Your wallet setup could not be prepared. Please retry." }, { status: 503 });
  }

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.privy.io/v1/wallets", {
      method: "POST",
      headers: {
        "privy-app-id": appId,
        Authorization: "Basic " + Buffer.from(appId + ":" + appSecret).toString("base64"),
        "privy-idempotency-key": idempotencyKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chain_type: "solana",
        display_name: "MYRAVEN " + (profile?.myraven_id ?? "Wallet"),
        external_id: "myraven-" + user.id,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "The wallet provider could not be reached. Retry in a moment." }, { status: 502 });
  }

  const providerData = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) {
    await admin.from("user_solana_wallets")
      .update({ provider_wallet_reference: null, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    return NextResponse.json({
      error: providerResponse.status === 401 || providerResponse.status === 403
        ? "Privy rejected the wallet credentials or permissions. Check the Privy app configuration."
        : "Privy could not create the wallet. Please retry.",
    }, { status: 502 });
  }

  const address = String(providerData.address ?? providerData.public_key ?? "");
  const walletId = String(providerData.id ?? "");
  if (!walletId || !SOLANA_ADDRESS_PATTERN.test(address)) {
    return NextResponse.json({ error: "The wallet provider returned an invalid Solana wallet response." }, { status: 502 });
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
    return NextResponse.json({ error: "The wallet was created, but MYRAVEN could not save its account link. Contact support before retrying." }, { status: 503 });
  }

  return NextResponse.json({ address, status: "provisioned", reused: false });
}
