import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.MYRAVEN_MODE !== "test") {
    return NextResponse.json({ error: "Mock settlement is available only in test mode." }, { status: 403 });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { deposit_id?: string; usdc_amount?: number; sol_amount?: number; outcome?: "success" | "failed" };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const depositId = String(body.deposit_id ?? "").trim();
  const usdcAmount = Number(body.usdc_amount);
  const solAmount = Number(body.sol_amount);
  const outcome = body.outcome ?? "success";

  if (!depositId || !Number.isFinite(usdcAmount) || usdcAmount <= 0 ||
      !Number.isFinite(solAmount) || solAmount <= 0 ||
      !["success", "failed"].includes(outcome)) {
    return NextResponse.json({ error: "Provide a deposit ID, positive simulated USDC and SOL amounts, and a valid outcome." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: deposit, error } = await admin.from("funding_deposits")
    .select("id,user_id,status,metadata")
    .eq("id", depositId)
    .eq("user_id", user.id)
    .eq("provider_code", "flutterwave")
    .maybeSingle();

  if (error || !deposit) return NextResponse.json({ error: "Flutterwave deposit not found." }, { status: 404 });
  if (deposit.status !== "converting" || deposit.metadata?.payment_state !== "successful" || deposit.metadata?.environment !== "test") {
    return NextResponse.json({ error: "Only a successfully verified Flutterwave test payment can enter mock settlement." }, { status: 409 });
  }

  if (deposit.metadata?.mock_settlement?.transfer_status === "simulated_success") {
    return NextResponse.json({ status: "simulated_success", settlement: deposit.metadata.mock_settlement, already_settled: true });
  }

  const mock = {
    mode: "simulation",
    provider: "MYRAVEN mock settlement",
    network: "solana",
    asset: "USDC",
    usdc_amount: usdcAmount,
    sol_asset: "SOL",
    sol_amount: solAmount,
    transfer_status: outcome === "success" ? "simulated_success" : "simulated_failure",
    conversion_status: outcome === "success" ? "simulated_success" : "not_run",
    wallet_credited: false,
    demo_balance_credit: outcome === "success" ? solAmount : 0,
    note: "Simulation only. No stablecoins were transferred and no wallet balance was changed.",
    completed_at: new Date().toISOString(),
  };

  const { error: updateError } = await admin.from("funding_deposits")
    .update({ metadata: { ...(deposit.metadata ?? {}), mock_settlement: mock } })
    .eq("id", deposit.id)
    .eq("user_id", user.id);

  if (updateError) return NextResponse.json({ error: "Could not save mock settlement result." }, { status: 500 });
  return NextResponse.json({ status: mock.transfer_status, settlement: mock });
}
