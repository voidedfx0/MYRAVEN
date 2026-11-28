"use client";

import { useEffect, useState } from "react";

type Deposit = {
  id: string;
  input_amount: number | string;
  input_currency: string;
  status: string;
  provider_reference: string | null;
  created_at: string;
};

type Stage = "idle" | "payment" | "converting" | "success" | "failed";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function SettlementTestPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selected, setSelected] = useState("");
  const [usdc, setUsdc] = useState("10");
  const [sol, setSol] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [solBalance, setSolBalance] = useState(0);
  const [lastSol, setLastSol] = useState(0);

  async function load() {
    const response = await fetch("/api/funding/deposits?all=1", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load deposits.");
    const rows = (data.deposits ?? []).filter((item: Deposit) => item.status === "converting");
    setDeposits(rows);
    if (!selected && rows[0]) setSelected(rows[0].id);
  }

  useEffect(() => { void load().catch((error) => setMessage(error.message)); }, []);

  async function simulate(outcome: "success" | "failed") {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    setStage("payment");
    await wait(1100);
    if (outcome === "success") setStage("converting");
    try {
      if (outcome === "success") await wait(1800);
      const response = await fetch("/api/funding/mock-settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deposit_id: selected,
          usdc_amount: Number(usdc),
          sol_amount: Number(sol),
          outcome,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Simulation failed.");
      if (outcome === "success") {
        setLastSol(Number(sol));
        setSolBalance((current) => current + Number(sol));
        setStage("success");
        setMessage("SOL successfully deposited to your MYRAVEN test balance.");
      } else {
        setStage("failed");
        setMessage("The simulated transfer failed. Your balance was not changed.");
      }
      await load();
    } catch (error) {
      setStage("failed");
      setMessage(error instanceof Error ? error.message : "Simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    { key: "payment", title: "Payment successful", detail: "Flutterwave test payment verified" },
    { key: "converting", title: "Converting to SOL", detail: "Simulating USDC on Solana → SOL" },
    { key: "success", title: "SOL deposited", detail: "Your test balance has been updated" },
  ];
  const active = stage === "failed" ? -1 : steps.findIndex((step) => step.key === stage);

  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 50% -15%, #30205d 0%, #10101d 42%, #080910 78%)", color: "#f7f6ff", padding: "38px 18px 70px", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @keyframes orbit { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 0 0 #9875ff33; } 50% { box-shadow: 0 0 0 13px #9875ff00; } }
        @keyframes glow { 0%,100% { opacity:.55 } 50% { opacity:1 } }
        .step-card { transition:all .35s ease; }
        .step-card.active { border-color:#9b7bff !important; background:#211b36 !important; box-shadow:0 0 28px #805aff20; }
        .step-card.done { border-color:#397e68 !important; background:#10251f !important; }
        .primary-btn { transition:transform .2s, filter .2s; }
        .primary-btn:hover { transform:translateY(-2px); filter:brightness(1.12); }
      `}</style>
      <div style={{ maxWidth: 850, margin: "0 auto" }}>
        <a href="/dashboard" style={{ color: "#c2b2ff", textDecoration: "none", fontSize: 14 }}>← Back to dashboard</a>
        <div style={{ textAlign: "center", margin: "38px auto 30px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #514174", borderRadius: 30, padding: "7px 13px", color: "#c8b8ff", fontSize: 11, letterSpacing: 2, background: "#171327" }}>MYRAVEN <span style={{ color: "#8d79c8" }}>·</span> TEST SETTLEMENT</div>
          <h1 style={{ fontSize: "clamp(32px,6vw,48px)", letterSpacing: "-1.8px", margin: "18px 0 9px", fontWeight: 750 }}>From payment to SOL.</h1>
          <p style={{ color: "#a8a5ba", margin: 0, fontSize: 15 }}>A seamless funding experience, simulated end to end.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 20 }}>
          <div style={{ border: "1px solid #353047", borderRadius: 18, padding: 21, background: "linear-gradient(135deg,#19152a,#11111b)" }}>
            <div style={{ color: "#aaa3c1", fontSize: 12 }}>MYRAVEN TEST SOL BALANCE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#a7f3d0,#6d42c5)", display: "grid", placeItems: "center", color: "#10101a", fontWeight: 900 }}>◎</div>
              <strong style={{ fontSize: 30, letterSpacing: "-1px" }}>{solBalance.toFixed(6)} <span style={{ color: "#aaa3c1", fontSize: 15 }}>SOL</span></strong>
            </div>
            <div style={{ color: "#77738c", fontSize: 11, marginTop: 10 }}>Demo balance · not withdrawable</div>
          </div>
          <div style={{ border: "1px solid #353047", borderRadius: 18, padding: 21, background: "#11111b" }}>
            <div style={{ color: "#aaa3c1", fontSize: 12 }}>LATEST CONVERSION</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 13 }}>{lastSol ? `+${lastSol.toFixed(6)} SOL` : "—"}</div>
            <div style={{ color: "#77738c", fontSize: 11, marginTop: 10 }}>{lastSol ? "Successfully added to test balance" : "Complete a test payment to begin"}</div>
          </div>
        </div>

        <section style={{ border: "1px solid #39334e", borderRadius: 22, padding: "clamp(18px,4vw,30px)", background: "linear-gradient(145deg,#151421,#101019)", boxShadow: "0 24px 80px #0006" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div><div style={{ color: "#a994ff", fontSize: 11, letterSpacing: 2 }}>SETTLEMENT JOURNEY</div><h2 style={{ fontSize: 22, margin: "7px 0 0" }}>Watch your funds arrive</h2></div>
            <span style={{ color: "#f4d58b", background: "#3a2c19", border: "1px solid #66502b", borderRadius: 20, padding: "7px 11px", fontSize: 10, letterSpacing: 1 }}>TEST MODE ONLY</span>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
            {steps.map((step, index) => {
              const done = stage === "success" || (stage === "converting" && index === 0) || (stage === "success" && index < 3);
              const isActive = active === index;
              return <div key={step.key} className={`step-card ${done ? "done" : isActive ? "active" : ""}`} style={{ display: "flex", gap: 14, alignItems: "center", padding: 15, border: "1px solid #302d3d", borderRadius: 14, background: "#12121c" }}>
                <div style={{ width: 38, height: 38, flex: "0 0 38px", borderRadius: "50%", display: "grid", placeItems: "center", background: done ? "#174b3b" : isActive ? "#49347b" : "#252333", color: done ? "#80f0bd" : "#c9b9ff", fontSize: 18, animation: isActive ? "pulse 1.5s infinite" : "none" }}>{done ? "✓" : index + 1}</div>
                <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 15 }}>{step.title}</div><div style={{ color: "#9691a8", fontSize: 12, marginTop: 4 }}>{step.detail}</div></div>
                {isActive && busy ? <span style={{ color: "#c8b8ff", fontSize: 11, animation: "glow 1s infinite" }}>IN PROGRESS</span> : done ? <span style={{ color: "#80f0bd", fontSize: 10 }}>COMPLETED</span> : null}
              </div>;
            })}
          </div>

          <div style={{ marginTop: 23, padding: 18, borderRadius: 16, background: "#0b0b13", border: "1px solid #2d293c" }}>
            <label style={{ display: "block", color: "#b9b3cb", fontSize: 12, marginBottom: 8 }}>Choose a verified Flutterwave test payment</label>
            <select value={selected} onChange={(event) => setSelected(event.target.value)} style={{ width: "100%", padding: 13, background: "#171622", color: "white", border: "1px solid #484258", borderRadius: 10 }}>
              <option value="">Select a successful payment</option>
              {deposits.map((deposit) => <option key={deposit.id} value={deposit.id}>{deposit.input_amount} {deposit.input_currency} · {deposit.provider_reference ?? deposit.id}</option>)}
            </select>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
              <label style={{ color: "#aaa4ba", fontSize: 12 }}>USDC received<input value={usdc} onChange={(event) => setUsdc(event.target.value)} type="number" min="0.000001" step="any" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, padding: 12, background: "#171622", color: "white", border: "1px solid #484258", borderRadius: 9 }} /></label>
              <label style={{ color: "#aaa4ba", fontSize: 12 }}>SOL to deposit<input value={sol} onChange={(event) => setSol(event.target.value)} type="number" min="0.000000001" step="any" style={{ display: "block", width: "100%", boxSizing: "border-box", marginTop: 7, padding: 12, background: "#171622", color: "white", border: "1px solid #484258", borderRadius: 9 }} /></label>
            </div>
            <button className="primary-btn" disabled={busy || !selected} onClick={() => void simulate("success")} style={{ width: "100%", marginTop: 18, padding: 15, border: 0, borderRadius: 11, color: "white", fontWeight: 750, fontSize: 14, background: "linear-gradient(100deg,#7551e8,#9c70ff)", cursor: busy || !selected ? "not-allowed" : "pointer", opacity: busy || !selected ? .55 : 1 }}>{busy ? "Processing your conversion…" : "Run SOL conversion simulation →"}</button>
            <button disabled={busy || !selected} onClick={() => void simulate("failed")} style={{ display: "block", margin: "12px auto 0", background: "transparent", border: 0, color: "#a69dbb", cursor: "pointer", fontSize: 12 }}>Test a failed payment instead</button>
          </div>

          {stage === "success" ? <div style={{ textAlign: "center", marginTop: 22, padding: 22, borderRadius: 16, background: "linear-gradient(135deg,#102b24,#15241f)", border: "1px solid #2e745a" }}>
            <div style={{ fontSize: 34, color: "#86f2bd" }}>✓</div><div style={{ fontSize: 21, fontWeight: 750, marginTop: 7 }}>SOL deposited successfully!</div><div style={{ color: "#b7d9ca", fontSize: 13, marginTop: 7 }}>+{lastSol.toFixed(6)} SOL added to your MYRAVEN test balance</div>
            <div style={{ fontSize: 12, color: "#86f2bd", marginTop: 14 }}>New demo balance: {solBalance.toFixed(6)} SOL</div>
          </div> : null}
          {stage === "failed" && message ? <p role="status" style={{ color: "#ffb6bd", marginTop: 18, textAlign: "center" }}>{message}</p> : null}
          {message && stage === "success" ? <p role="status" style={{ color: "#91e9bf", textAlign: "center", fontSize: 12 }}>{message}</p> : null}
        </section>
        <p style={{ textAlign: "center", color: "#6f6a80", fontSize: 11, lineHeight: 1.6, marginTop: 18 }}>This is a visual test simulation. No real USDC or SOL is transferred, and your actual wallet balance is not credited.</p>
      </div>
    </main>
  );
}
