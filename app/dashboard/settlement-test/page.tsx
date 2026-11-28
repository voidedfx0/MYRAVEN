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

export default function SettlementTestPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [selected, setSelected] = useState("");
  const [usdc, setUsdc] = useState("10");
  const [sol, setSol] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<unknown>(null);

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
    setResult(null);
    try {
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
      setResult(data.settlement);
      setMessage(outcome === "success" ? "Mock USDC transfer and SOL conversion completed." : "Mock transfer failure recorded.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Simulation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#080910", color: "#f5f5fa", padding: "48px 20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <a href="/dashboard" style={{ color: "#b9a8ff", textDecoration: "none" }}>← Back to dashboard</a>
        <p style={{ color: "#a78bfa", letterSpacing: 2, fontSize: 12, marginTop: 32 }}>MYRAVEN · DEVELOPER TOOLS</p>
        <h1 style={{ fontSize: 32, margin: "8px 0" }}>Settlement test console</h1>
        <p style={{ color: "#aaaab8", lineHeight: 1.6 }}>Simulate the USDC-on-Solana transfer and USDC-to-SOL conversion for a verified Flutterwave test payment.</p>
        <div style={{ border: "1px solid #343344", background: "#11121c", borderRadius: 16, padding: 22, marginTop: 24 }}>
          <b style={{ color: "#fbbf24" }}>TEST SIMULATION ONLY · NO REAL FUNDS</b>
          <p style={{ color: "#aaaab8", fontSize: 13 }}>This records a mock result only. It does not contact Flutterwave, submit a Solana transaction, or credit a wallet balance.</p>
          <label style={{ display: "block", marginTop: 20, fontSize: 13 }}>Verified payment to simulate</label>
          <select value={selected} onChange={(event) => setSelected(event.target.value)} style={{ width: "100%", padding: 12, marginTop: 8, background: "#080910", color: "white", border: "1px solid #454456", borderRadius: 8 }}>
            <option value="">Select a successful payment</option>
            {deposits.map((deposit) => <option key={deposit.id} value={deposit.id}>{deposit.input_amount} {deposit.input_currency} · {deposit.provider_reference ?? deposit.id} · {new Date(deposit.created_at).toLocaleString()}</option>)}
          </select>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
            <label style={{ fontSize: 13 }}>Simulated USDC amount<input value={usdc} onChange={(event) => setUsdc(event.target.value)} type="number" min="0.000001" step="any" style={{ display: "block", width: "100%", padding: 12, marginTop: 8, background: "#080910", color: "white", border: "1px solid #454456", borderRadius: 8, boxSizing: "border-box" }} /></label>
            <label style={{ fontSize: 13 }}>Simulated SOL output<input value={sol} onChange={(event) => setSol(event.target.value)} type="number" min="0.000000001" step="any" style={{ display: "block", width: "100%", padding: 12, marginTop: 8, background: "#080910", color: "white", border: "1px solid #454456", borderRadius: 8, boxSizing: "border-box" }} /></label>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            <button disabled={busy || !selected} onClick={() => void simulate("success")} style={{ padding: "12px 18px", border: 0, borderRadius: 8, background: "#7c5cff", color: "white", fontWeight: 700, cursor: "pointer" }}>{busy ? "Processing…" : "Simulate success"}</button>
            <button disabled={busy || !selected} onClick={() => void simulate("failed")} style={{ padding: "12px 18px", border: "1px solid #75434b", borderRadius: 8, background: "#29151a", color: "#ffb5bd", cursor: "pointer" }}>Simulate failure</button>
            <button onClick={() => void load().catch((error) => setMessage(error.message))} style={{ padding: "12px 18px", border: "1px solid #454456", borderRadius: 8, background: "transparent", color: "white", cursor: "pointer" }}>Refresh payments</button>
          </div>
          {message ? <p role="status" style={{ marginTop: 18, color: "#ddd5ff" }}>{message}</p> : null}
          {result ? <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", background: "#080910", padding: 14, borderRadius: 8, color: "#b9f5d0", fontSize: 12 }}>{JSON.stringify(result, null, 2)}</pre> : null}
        </div>
      </div>
    </main>
  );
}
