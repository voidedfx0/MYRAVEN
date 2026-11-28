"use server";

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function money(amount: number | string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount) + " " + currency;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + currency;
  }
}

function statusLabel(status: string) {
  if (status === "credited") return "SOL credited";
  if (status === "converting") return "Payment completed · SOL conversion pending";
  if (status === "submitted_onchain" || status === "confirming") return "SOL settlement processing";
  if (status === "awaiting_payment") return "Awaiting payment confirmation";
  return status.replaceAll("_", " ");
}

export default async function FundingActivityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: deposits, error } = await supabase
    .from("funding_deposits")
    .select("id,funding_method,input_currency,input_amount,target_asset,credited_output_amount,status,failure_code,provider_code,provider_reference,chain_code,metadata,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="app-frame">
      <section className="main-area">
        <header className="top-header">
          <div className="breadcrumb"><Link href="/dashboard">Workspace</Link> <span>/</span> <b>Activity</b></div>
          <Link className="connect-button" href="/dashboard">Back to overview</Link>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">MYRAVEN · TRANSACTION RECORDS</div>
              <h1>Activity</h1>
              <p>Your complete funding history and payment verification details.</p>
            </div>
            <div className="welcome-date"><span>RECORDS</span><b>{deposits?.length ?? 0} transactions</b></div>
          </section>

          <section className="panel funding-hub-panel">
            <div className="panel-heading">
              <div><span className="panel-kicker">ALL TRANSACTIONS</span><h2>Funding activity</h2><p>Latest first · Up to 100 recent records</p></div>
            </div>
            {error ? <p className="funding-disclaimer">Transaction history is temporarily unavailable. Please refresh and try again.</p>
              : deposits?.length ? (
                <div className="funding-history-list">
                  {deposits.map((deposit) => {
                    const metadata = deposit.metadata && typeof deposit.metadata === "object"
                      ? deposit.metadata as Record<string, unknown> : {};
                    const country = typeof metadata.country_code === "string" ? metadata.country_code : "—";
                    return (
                      <article className="funding-history-item" key={deposit.id}>
                        <span className="funding-history-mark"><span aria-hidden="true">↔</span></span>
                        <span className="funding-history-copy">
                          <b>{money(deposit.input_amount, deposit.input_currency)} · {deposit.target_asset} wallet funding</b>
                          <small>Method: {String(deposit.funding_method).replaceAll("_", " ")} · Provider: {deposit.provider_code ?? "—"} · Country: {country}</small>
                          <small>Reference: {deposit.provider_reference ?? "Not assigned"} · Network: {deposit.chain_code ?? "—"}</small>
                          <small>Created: {new Date(deposit.created_at).toLocaleString()} · Updated: {new Date(deposit.updated_at ?? deposit.created_at).toLocaleString()}</small>
                          {deposit.failure_code ? <small>Review code: {deposit.failure_code}</small> : null}
                        </span>
                        <span className={`funding-history-status status-${deposit.status}`}>
                          <b>{statusLabel(deposit.status)}</b>
                          {deposit.credited_output_amount !== null && deposit.credited_output_amount !== undefined
                            ? <small>{deposit.credited_output_amount} {deposit.target_asset} credited</small>
                            : deposit.status === "converting"
                              ? <small>Fiat payment verified · crypto not yet settled</small>
                              : <small>{deposit.status.replaceAll("_", " ")}</small>}
                        </span>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="funding-history-empty">No funding transactions yet. Your verified payments will appear here.</p>}
          </section>
          <p className="funding-disclaimer">A Flutterwave payment is marked completed only after server-side verification. SOL appears in your spendable balance only after conversion and Solana settlement have both been confirmed.</p>
        </div>
      </section>
    </main>
  );
}
