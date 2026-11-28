"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, QrCode, RefreshCw, ShieldCheck, Wallet } from "lucide-react";

type AccountDetails = {
  profile: {
    myraven_id: string;
    account_number: string;
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  solanaWallet: {
    wallet_address: string | null;
    status: string;
    network: string;
    custody_provider: string | null;
  } | null;
};

export default function AccountDetailsPage() {
  const [details, setDetails] = useState<AccountDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState("https://myraven.vercel.app");

  async function loadDetails() {
    const response = await fetch("/api/account/summary", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Account details could not be loaded.");
    setDetails({ profile: data.profile, solanaWallet: data.solanaWallet });
    return data as AccountDetails;
  }

  async function createWallet() {
    setWalletLoading(true);
    setMessage("Creating your unique Solana address…");
    try {
      const response = await fetch("/api/account/wallet", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Wallet creation failed.");
      await loadDetails();
      setMessage("Your personal Solana receiving address is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet creation is unavailable.");
    } finally {
      setWalletLoading(false);
    }
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadDetails()
      .then((data) => {
        if (!data.solanaWallet?.wallet_address || data.solanaWallet.status !== "provisioned") {
          void createWallet();
        }
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Account details could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const profile = details?.profile;
  const walletAddress = details?.solanaWallet?.wallet_address ?? "";
  const qrPayload = useMemo(() => {
    if (!profile?.myraven_id || !profile.account_number) return "";
    const params = new URLSearchParams({
      to: profile.myraven_id,
      account: profile.account_number,
    });
    if (walletAddress) params.set("sol", walletAddress);
    return origin + "/dashboard?" + params.toString();
  }, [profile, walletAddress, origin]);
  const qrImage = qrPayload
    ? "https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=" + encodeURIComponent(qrPayload)
    : "";

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(label + " copied.");
    } catch {
      setMessage("Copy is unavailable in this browser.");
    }
  }

  return (
    <main className="app-frame" style={{ minHeight: "100vh", padding: "34px 20px 60px" }}>
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <a href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "#a9afbf", fontSize: 13, marginBottom: 30 }}>
          <ArrowLeft size={16} /> Back to dashboard
        </a>
        <div style={{ marginBottom: 25 }}>
          <span className="panel-kicker">YOUR MYRAVEN PROFILE</span>
          <h1 style={{ fontSize: "clamp(28px,5vw,42px)", margin: "9px 0 8px", letterSpacing: "-.04em" }}>Account details</h1>
          <p style={{ color: "#9aa1b2", margin: 0 }}>Your unique MYRAVEN identity and personal receiving details.</p>
        </div>

        {loading ? <div className="panel" style={{ padding: 28 }}>Loading your account details…</div> : !profile ? (
          <div className="panel" style={{ padding: 28 }}>Your profile could not be found. Please sign in again.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(260px,.8fr)", gap: 18, alignItems: "start" }}>
            <section className="panel" style={{ padding: "clamp(20px,4vw,32px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 25 }}>
                <div>
                  <span className="panel-kicker">PERSONAL ACCOUNT</span>
                  <h2 style={{ margin: "7px 0 0", fontSize: 22 }}>{profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "MYRAVEN member"}</h2>
                </div>
                <span className="read-only-tag"><ShieldCheck size={13} /> UNIQUE TO YOU</span>
              </div>

              <div style={{ display: "grid", gap: 13 }}>
                <div style={{ padding: 18, borderRadius: 15, border: "1px solid rgba(155,123,255,.28)", background: "linear-gradient(120deg,rgba(124,58,237,.13),rgba(84,217,239,.04))" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span className="panel-kicker">MYRAVEN ID</span>
                    <button className="connect-button" onClick={() => void copy(profile.myraven_id, "MYRAVEN ID")}><Copy size={13} /> Copy</button>
                  </div>
                  <strong style={{ display: "block", fontSize: "clamp(25px,5vw,34px)", letterSpacing: ".04em", marginTop: 9 }}>{profile.myraven_id}</strong>
                  <small style={{ color: "#9ca3b4" }}>Your name-based ID with a unique 4-digit ending</small>
                </div>

                <div style={{ padding: 18, borderRadius: 15, border: "1px solid var(--line)", background: "rgba(255,255,255,.025)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span className="panel-kicker">ACCOUNT NUMBER</span>
                    <button className="connect-button" onClick={() => void copy(profile.account_number, "Account number")}><Copy size={13} /> Copy</button>
                  </div>
                  <strong style={{ display: "block", fontSize: 26, letterSpacing: ".1em", marginTop: 9, fontVariantNumeric: "tabular-nums" }}>{profile.account_number}</strong>
                  <small style={{ color: "#9ca3b4" }}>Unique MYRAVEN account number</small>
                </div>

                <div style={{ padding: 18, borderRadius: 15, border: "1px solid var(--line)", background: "rgba(255,255,255,.025)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span className="panel-kicker">SOLANA RECEIVING ADDRESS · DEVNET</span>
                    {walletAddress ? <span className="connected-label"><i /> Ready</span> : <span className="read-only-tag">SETUP</span>}
                  </div>
                  {walletAddress ? (
                    <>
                      <code style={{ display: "block", overflowWrap: "anywhere", lineHeight: 1.7, fontSize: 13, color: "#d8d1ff", margin: "12px 0" }}>{walletAddress}</code>
                      <button className="connect-button" onClick={() => void copy(walletAddress, "SOL address")}><Copy size={13} /> Copy address</button>
                    </>
                  ) : (
                    <div style={{ marginTop: 12, color: "#aab0c0", fontSize: 13 }}>A unique wallet address is being provisioned through Privy. Your account ID and number are already active.</div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#8f98aa", fontSize: 12, marginTop: 19 }}>
                <ShieldCheck size={15} /> Your receiving address is personal. Never share wallet recovery credentials.
              </div>
            </section>

            <aside className="panel" style={{ padding: 22, textAlign: "center" }}>
              <span className="panel-kicker">SCAN TO PAY</span>
              <div style={{ display: "grid", placeItems: "center", padding: 13, background: "#fff", borderRadius: 16, margin: "16px auto", width: "min(100%,260px)", aspectRatio: "1" }}>
                {qrImage ? <img src={qrImage} alt="MYRAVEN account QR code" width="230" height="230" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <QrCode size={60} color="#111" />}
              </div>
              <h3 style={{ margin: "8px 0", fontSize: 17 }}>Your MYRAVEN QR</h3>
              <p style={{ color: "#9aa1b2", fontSize: 12, lineHeight: 1.6, margin: "0 0 16px" }}>Includes your MYRAVEN ID and account number. Your SOL address is included once wallet setup is complete.</p>
              <button className="primary-action" style={{ width: "100%", justifyContent: "center" }} onClick={() => void copy(qrPayload, "Payment link")} disabled={!qrPayload}><Copy size={15} /> Copy payment link</button>
              {walletLoading ? <p style={{ color: "#aab0c0", fontSize: 12, marginTop: 15 }}><RefreshCw size={13} className="spin" style={{ verticalAlign: "middle" }} /> Creating your SOL wallet…</p> : null}
              {!walletAddress ? <button className="connect-button" style={{ marginTop: 12 }} onClick={() => void createWallet()} disabled={walletLoading}><Wallet size={13} /> Retry wallet setup</button> : null}
            </aside>
          </div>
        )}
        {message ? <p role="status" style={{ color: "#b9c2d3", fontSize: 13, marginTop: 18 }}>{message}</p> : null}
        <p style={{ color: "#778094", fontSize: 11, marginTop: 24 }}>MYRAVEN is in test mode. The SOL address is a Devnet receiving address; it is not a mainnet deposit address.</p>
      </div>
    </main>
  );
}
