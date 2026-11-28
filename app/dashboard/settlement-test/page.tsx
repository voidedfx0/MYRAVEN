"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Wallet, CheckCircle2, Clock3, AlertCircle } from "lucide-react";

type Deposit = {
  id: string;
  input_amount: number | string;
  input_currency: string;
  target_asset: string;
  credited_output_amount?: number | string | null;
  status: string;
  provider_reference: string | null;
  created_at: string;
  metadata?: {
    payment_state?: string;
    environment?: string;
    treasury_settlement?: {
      transfer_status?: string;
      sol_amount?: number | string;
      blockchain_signature?: string;
      wallet_credited?: boolean;
    };
  };
};

type WalletBalance = { availableSol?: number | null; address?: string; error?: string };

export default function SettlementTestPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      let response = await fetch("/api/funding/deposits?all=1", { cache: "no-store" });
      let data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not load funding activity.");
      const all: Deposit[] = data.deposits ?? [];

      const toVerify = all.filter((item: Deposit) =>
        item.provider_reference &&
        /^MRV-FUND-[0-9a-f-]{36}$/i.test(item.provider_reference) &&
        !["credited", "failed", "cancelled", "expired", "recovery_pending"].includes(item.status) &&
        item.metadata?.payment_state !== "successful"
      );
      for (const item of toVerify) {
        await fetch("/api/funding/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_ref: item.provider_reference }),
        }).catch(() => null);
      }

      response = await fetch("/api/funding/deposits?all=1", { cache: "no-store" });
      data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not refresh funding activity.");
      const latest: Deposit[] = data.deposits ?? [];

      const ready = latest.filter((item: Deposit) =>
        item.status === "converting" &&
        item.metadata?.payment_state === "successful" &&
        item.metadata?.environment === "test" &&
        item.target_asset === "SOL" &&
        item.metadata?.treasury_settlement?.transfer_status !== "confirmed"
      );
      if (ready.length) {
        setBusy(true);
        await Promise.all(ready.map((item: Deposit) =>
          fetch("/api/funding/settle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deposit_id: item.id }),
          }).catch(() => null)
        ));
        setBusy(false);
        response = await fetch("/api/funding/deposits?all=1", { cache: "no-store" });
        data = await response.json();
      }

      const rows: Deposit[] = data.deposits ?? [];
      setDeposits(rows.filter((item: Deposit) => item.provider_reference && /^MRV-FUND-[0-9a-f-]{36}$/i.test(item.provider_reference)));

      const walletResponse = await fetch("/api/account/wallet/balance", { cache: "no-store" });
      const walletData: WalletBalance = await walletResponse.json();
      if (walletResponse.ok && typeof walletData.availableSol === "number") {
        setBalance(walletData.availableSol);
        setAddress(walletData.address ?? "");
      } else {
        setBalance(null);
        if (walletData.error) setMessage(walletData.error);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not refresh settlement status.");
    } finally {
      setBusy(false);
      loading.current = false;
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { void load(); }, 10000);
    return () => window.clearInterval(timer);
  }, [load]);

  const pendingCount = deposits.filter((item) => item.status === "converting").length;
  const credited = deposits.filter((item) => item.status === "credited");
  const latestCredit = credited[0];

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% -15%, #30205d 0%, #10101d 42%, #080910 78%)", color: "#f7f6ff", padding: "38px 18px 70px", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <a href="/dashboard" style={{ color: "#c2b2ff", textDecoration: "none", fontSize: 14 }}>← Back to dashboard</a>
        <div style={{ textAlign: "center", margin: "38px auto 30px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #514174", borderRadius: 30, padding: "7px 13px", color: "#c8b8ff", fontSize: 11, letterSpacing: 2, background: "#171327" }}>MYRAVEN <span style={{ color: "#8d79c8" }}>·</span> DEVNET SETTLEMENT</div>
          <h1 style={{ fontSize: "clamp(32px,6vw,48px)", letterSpacing: "-1.8px", margin: "18px 0 9px", fontWeight: 750 }}>Funding to SOL.</h1>
          <p style={{ color: "#a8a5ba", margin: 0, fontSize: 15 }}>Verified test payments settle from the shared treasury into your existing Privy wallet.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 20 }}>
          <div style={{ border: "1px solid #353047", borderRadius: 18, padding: 21, background: "linear-gradient(135deg,#19152a,#11111b)" }}>
            <div style={{ color: "#aaa3c1", fontSize: 12 }}>AVAILABLE TO SEND</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#a7f3d0,#6d42c5)", display: "grid", placeItems: "center", color: "#10101a" }}><Wallet size={19}/></div>
              <strong style={{ fontSize: 30, letterSpacing: "-1px" }}>{balance === null ? "—" : balance.toLocaleString("en-US", { maximumFractionDigits: 8 })} <span style={{ color: "#aaa3c1", fontSize: 15 }}>SOL</span></strong>
            </div>
            <div style={{ color: "#77738c", fontSize: 11, marginTop: 10 }}>Live confirmed Solana Devnet wallet balance</div>
          </div>
          <div style={{ border: "1px solid #353047", borderRadius: 18, padding: 21, background: "#11111b" }}>
            <div style={{ color: "#aaa3c1", fontSize: 12 }}>LATEST WALLET CREDIT</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 13 }}>{latestCredit?.credited_output_amount ? "+" + Number(latestCredit.credited_output_amount).toFixed(8) + " SOL" : "—"}</div>
            <div style={{ color: "#77738c", fontSize: 11, marginTop: 10 }}>{latestCredit ? "Confirmed in your Privy wallet" : "Waiting for a confirmed settlement"}</div>
          </div>
        </div>

        <section style={{ border: "1px solid #39334e", borderRadius: 22, padding: "clamp(18px,4vw,30px)", background: "linear-gradient(145deg,#151421,#101019)", boxShadow: "0 24px 80px #0006" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div><div style={{ color: "#a994ff", fontSize: 11, letterSpacing: 2 }}>SETTLEMENT STATUS</div><h2 style={{ fontSize: 22, margin: "7px 0 0" }}>Your funding activity</h2></div>
            <button onClick={() => void load()} disabled={busy} style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #514174", borderRadius: 10, padding: "9px 12px", color: "#d4caff", background: "#171327", cursor: "pointer" }}><RefreshCw size={14}/> Refresh</button>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <span style={{ color: "#f4d58b", background: "#3a2c19", border: "1px solid #66502b", borderRadius: 20, padding: "7px 11px", fontSize: 10, letterSpacing: 1 }}>DEVNET TEST MODE</span>
            <span style={{ color: "#b7d9ca", background: "#10251f", border: "1px solid #397e68", borderRadius: 20, padding: "7px 11px", fontSize: 10 }}>{pendingCount} PENDING</span>
            <span style={{ color: "#c8b8ff", background: "#211b36", border: "1px solid #514174", borderRadius: 20, padding: "7px 11px", fontSize: 10 }}>{credited.length} CREDITED</span>
          </div>
          {busy ? <p style={{ color: "#c8b8ff", fontSize: 12, marginTop: 18 }}>Treasury settlement is processing. Your available balance changes only after Solana confirms the transfer.</p> : null}
          {message ? <p role="status" style={{ color: "#ffb6bd", fontSize: 12, marginTop: 18 }}>{message}</p> : null}
          <div style={{ display: "grid", gap: 10, marginTop: 22 }}>
            {deposits.length === 0 ? <p style={{ color: "#9691a8", fontSize: 13 }}>No Flutterwave funding requests yet.</p> : deposits.slice(0, 15).map((item) => {
              const done = item.status === "credited";
              const pending = item.status === "converting";
              const failed = ["failed", "recovery_pending"].includes(item.status);
              const state = done ? "SOL credited" : pending ? (item.metadata?.treasury_settlement?.transfer_status ? "Treasury transfer pending" : "Payment verified · settling") : failed ? "Needs review" : item.status;
              return <div key={item.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: 15, border: "1px solid #302d3d", borderRadius: 14, background: "#12121c" }}>
                <div style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: "50%", display: "grid", placeItems: "center", background: done ? "#174b3b" : pending ? "#49347b" : "#252333", color: done ? "#80f0bd" : "#c9b9ff" }}>{done ? <CheckCircle2 size={19}/> : pending ? <Clock3 size={19}/> : <AlertCircle size={19}/>}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{item.input_amount} {item.input_currency} · {item.target_asset}</div><div style={{ color: "#9691a8", fontSize: 12, marginTop: 4 }}>{new Date(item.created_at).toLocaleString()}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ color: done ? "#80f0bd" : pending ? "#c8b8ff" : "#a69dbb", fontSize: 12, fontWeight: 700 }}>{state}</div><div style={{ color: "#9691a8", fontSize: 11, marginTop: 4 }}>{done && item.credited_output_amount ? Number(item.credited_output_amount).toFixed(8) + " SOL" : "Not spendable yet"}</div></div>
              </div>;
            })}
          </div>
        </section>

        <p style={{ textAlign: "center", color: "#6f6a80", fontSize: 11, lineHeight: 1.6, marginTop: 18 }}>Test payments are not real-money-backed crypto purchases. MYRAVEN uses shared Devnet treasury SOL; confirmed transfers appear in the same wallet balance used for sending. {address ? "Wallet: " + address.slice(0, 6) + "…" + address.slice(-6) : ""}</p>
      </div>
    </main>
  );
}
