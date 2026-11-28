import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function walletFrom(value: any) {
  const root = value && typeof value === "object" ? value : {};
  const data = root.data && typeof root.data === "object" ? root.data : {};
  return root.wallet ?? data.wallet ?? root.data ?? root;
}

async function privyCreate(appId: string, secret: string, quorumId: string) {
  const response = await fetch("https://api.privy.io/v1/wallets", {
    method: "POST",
    headers: {
      "privy-app-id": appId,
      Authorization: "Basic " + Buffer.from(appId + ":" + secret).toString("base64"),
      "Content-Type": "application/json",
      "privy-idempotency-key": "myraven-treasury-solana-devnet-v1",
    },
    body: JSON.stringify({
      chain_type: "solana",
      display_name: "MYRAVEN Treasury · Devnet",
      external_id: "myraven-treasury-solana-devnet-v1",
      owner_id: quorumId,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("Privy wallet creation failed (HTTP " + response.status + "). Check wallet permissions and the MYRAVEN quorum.");
  }
  return walletFrom(payload);
}

export async function POST() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  if (process.env.MYRAVEN_MODE !== "test" || (process.env.SOLANA_NETWORK ?? "devnet").toLowerCase() !== "devnet") {
    return NextResponse.json({ error: "Treasury provisioning is restricted to MYRAVEN Devnet test mode." }, { status: 409 });
  }

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const secret = process.env.PRIVY_APP_SECRET;
  const quorumId = process.env.NEXT_PUBLIC_PRIVY_KEY_QUORUM_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!appId || !secret || !quorumId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Privy or Supabase server configuration is incomplete." }, { status: 503 });
  }

  const admin = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: existing, error: readError } = await admin
    .from("myraven_treasury_wallets")
    .select("wallet_address,provider_wallet_reference,status,network")
    .eq("network", "solana-devnet")
    .maybeSingle();

  if (readError) return NextResponse.json({ error: "Could not read treasury record." }, { status: 503 });
  if (existing?.wallet_address) {
    return NextResponse.json({ status: existing.status, address: existing.wallet_address, wallet_id: existing.provider_wallet_reference, network: "devnet", reused: true });
  }

  try {
    const wallet = await privyCreate(appId, secret, quorumId);
    const address = String(wallet.address ?? wallet.public_key ?? wallet.publicKey ?? "");
    const walletId = String(wallet.id ?? wallet.wallet_id ?? wallet.walletId ?? "");
    if (!walletId || !ADDRESS.test(address)) {
      return NextResponse.json({ error: "Privy returned an incomplete treasury wallet record." }, { status: 502 });
    }

    const { data: saved, error: saveError } = await admin
      .from("myraven_treasury_wallets")
      .upsert({
        network: "solana-devnet",
        custody_provider: "privy",
        wallet_address: address,
        provider_wallet_reference: walletId,
        status: "provisioned",
        updated_at: new Date().toISOString(),
      }, { onConflict: "network", ignoreDuplicates: true })
      .select("wallet_address,provider_wallet_reference,status")
      .maybeSingle();

    if (saveError) return NextResponse.json({ error: "Treasury was created in Privy but its MYRAVEN record could not be saved. Retry safely." }, { status: 503 });
    if (saved) return NextResponse.json({ status: saved.status, address: saved.wallet_address, wallet_id: saved.provider_wallet_reference, network: "devnet", reused: false });

    const { data: recovered } = await admin.from("myraven_treasury_wallets")
      .select("wallet_address,provider_wallet_reference,status")
      .eq("network", "solana-devnet")
      .maybeSingle();
    if (recovered) return NextResponse.json({ status: recovered.status, address: recovered.wallet_address, wallet_id: recovered.provider_wallet_reference, network: "devnet", reused: true });
    return NextResponse.json({ error: "Treasury creation is still being reconciled. Retry shortly." }, { status: 503 });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Treasury creation failed." }, { status: 502 });
  }
}
