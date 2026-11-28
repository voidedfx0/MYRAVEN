import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ReconcileActivity from "./reconcile-activity";
import ScheduledTransferActivity from "./scheduled-transfer-activity";
import { ArrowLeft } from "lucide-react";

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

export default async function FundingActivityPage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const view = ["sent", "received", "fund", "pending"].includes(params?.view ?? "") ? params!.view! : "pending";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [depositResult, transactionResult] = await Promise.all([
    supabase.from("funding_deposits")
      .select("id,funding_method,input_currency,input_amount,target_asset,credited_output_amount,status,failure_code,provider_code,provider_reference,chain_code,metadata,created_at,updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase.from("ledger_transactions")
      .select("id,source_type,source_reference,status,description,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);
  const deposits = depositResult.data ?? [];
  const transactions = transactionResult.data ?? [];
  const referencesToVerify = deposits.filter((deposit) => {
    const metadata = deposit.metadata && typeof deposit.metadata === "object" ? deposit.metadata as Record<string, unknown> : {};
    return Boolean(deposit.provider_reference)
      && /^MRV-FUND-[0-9a-f-]{36}$/i.test(deposit.provider_reference ?? "")
      && !["credited", "failed", "cancelled", "expired", "recovery_pending"].includes(deposit.status)
      && metadata.payment_state !== "successful";
  }).map((deposit) => deposit.provider_reference as string);
  const sentTransactions = transactions.filter((item) => item.source_type === "transfer" && (item.description ?? "").startsWith("Sent "));
  const receivedTransactions = transactions.filter((item) => item.source_type === "transfer" && (item.description ?? "").startsWith("Received "));
  const pendingTransactions = transactions.filter((item) => item.status === "pending");
  const pendingDeposits = deposits.filter((item) => ["awaiting_payment", "converting", "submitted_onchain", "confirming"].includes(item.status));
  const error = depositResult.error || transactionResult.error;

  return (
    <main className="app-frame">
      <section className="main-area">
        <header className="top-header">
          <div className="breadcrumb"><Link href="/dashboard">Workspace</Link> <span>/</span> <b>Activity</b></div>
          <Link className="activity-back-button" href="/dashboard" aria-label="Back to overview"><ArrowLeft size={16} /><span>Back</span></Link>
        </header>
        <div className="content-wrap">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">MYRAVEN · TRANSACTION RECORDS</div>
              <h1>Activity</h1>
              <p>Your complete funding history and payment verification details.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}><div className="welcome-date"><span>RECORDS</span><b>{deposits.length + transactions.length} transactions</b></div><ReconcileActivity references={referencesToVerify} /></div>
          </section>

          <nav aria-label="Activity categories" style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:18}}>
            {(["sent","received","fund","pending"] as const).map((item) => (
              <Link key={item} href={"/dashboard/activity?view="+item} className={view===item?"activity-filter active":"activity-filter"}>{item==="fund"?"Fund":item[0].toUpperCase()+item.slice(1)}</Link>
            ))}
          </nav>
          {view === "fund" ? (
            <section className="panel funding-hub-panel">
              <div className="panel-heading"><div><span className="panel-kicker">FUND</span><h2>Wallet funding</h2><p>Verified funding and conversion records</p></div></div>
              {error ? <p className="funding-disclaimer">Activity is temporarily unavailable.</p> : deposits.length ? <div className="funding-history-list">{deposits.map((deposit) => (
                <article className="funding-history-item" key={deposit.id}>
                  <span className="funding-history-mark">↓</span>
                  <span className="funding-history-copy"><b>{money(deposit.input_amount,deposit.input_currency)} · {deposit.target_asset} funding</b><small>{deposit.provider_code ?? "Payment provider"} · {new Date(deposit.created_at).toLocaleString()}</small></span>
                  <span className={"funding-history-status status-"+deposit.status}><b>{statusLabel(deposit.status)}</b>{deposit.credited_output_amount != null ? <small>{deposit.credited_output_amount} {deposit.target_asset} credited</small> : null}</span>
                </article>
              ))}</div> : <p className="funding-history-empty">No funding yet.</p>}
            </section>
          ) : view === "sent" || view === "received" ? (
            <section className="panel funding-hub-panel">
              <div className="panel-heading"><div><span className="panel-kicker">{view.toUpperCase()}</span><h2>{view === "sent" ? "Money sent" : "Money received"}</h2></div></div>
              {(() => { const rows = view === "sent" ? sentTransactions : receivedTransactions; return rows.length ? <div className="funding-history-list">{rows.map((item) => (
                <article className="funding-history-item" key={item.id}><span className="funding-history-mark">{view==="sent"?"↗":"↙"}</span><span className="funding-history-copy"><b>{item.description}</b><small>{new Date(item.created_at).toLocaleString()}</small></span><span className={"funding-history-status status-"+item.status}><b>{item.status==="posted"?"Successful":item.status}</b><small>Solana Devnet</small></span></article>
              ))}</div> : <p className="funding-history-empty">No {view} transfers yet.</p>; })()}
            </section>
          ) : (
            <section className="panel funding-hub-panel">
              <div className="panel-heading"><div><span className="panel-kicker">PENDING</span><h2>Awaiting completion</h2><p>Transfers and funding still processing</p></div></div>
              {pendingTransactions.length || pendingDeposits.length ? <div className="funding-history-list">
                <ScheduledTransferActivity />
                {pendingTransactions.map((item)=><article className="funding-history-item" key={item.id}><span className="funding-history-mark">◷</span><span className="funding-history-copy"><b>{item.description}</b><small>{new Date(item.created_at).toLocaleString()}</small></span><span className="funding-history-status status-pending"><b>Pending</b></span></article>)}
                {pendingDeposits.map((item)=><article className="funding-history-item" key={item.id}><span className="funding-history-mark">◷</span><span className="funding-history-copy"><b>{money(item.input_amount,item.input_currency)} funding · {item.target_asset}</b><small>{new Date(item.created_at).toLocaleString()}</small></span><span className="funding-history-status status-pending"><b>{statusLabel(item.status)}</b></span></article>)}
              </div>  : <><ScheduledTransferActivity /><p className="funding-history-empty">Nothing pending.</p></>}
            </section>
          )}
          <p className="funding-disclaimer">Transfers appear as successful only after Solana confirms them. Recipients are notified and their available wallet balance refreshes after confirmation.</p>
        </div>
      </section>
    </main>
  );
}
