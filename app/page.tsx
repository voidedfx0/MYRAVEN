"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, CircleHelp, Clock3, Globe2, LayoutDashboard, LockKeyhole,
  Menu, Plus, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Wallet, WalletCards, X,
} from "lucide-react";

type Quote = {
  id: string; rail: "solana" | "stellar" | "bank"; label: string;
  estimatedFee: number; estimatedMinutes: number; reliability: number;
  recipientAmount: number; score: number; reasons: string[]; simulated: true;
};
type WalletConnection = { network: "Solana" | "Stellar"; address: string; name: string };

declare global {
  interface Window {
    solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> };
    freighterApi?: {
      isConnected: () => Promise<{ isConnected: boolean }>;
      requestAccess: () => Promise<{ address: string; error?: { message: string } }>;
    };
  }
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

function shortAddress(address: string) {
  return address.length > 16 ? address.slice(0, 7) + "…" + address.slice(-6) : address;
}

export default function Home() {
  const [amount, setAmount] = useState("100");
  const [sourceCurrency, setSourceCurrency] = useState("USD");
  const [destinationCurrency, setDestinationCurrency] = useState("NGN");
  const [destination, setDestination] = useState("bank");
  const [preference, setPreference] = useState("balanced");
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [notice, setNotice] = useState("Choose your payment details to compare routes.");
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<WalletConnection[]>([]);
  const [walletMessage, setWalletMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState("");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approved, setApproved] = useState(false);

  const bestQuote = useMemo(() => quotes.find((quote) => quote.id === selectedRoute) ?? quotes[0], [quotes, selectedRoute]);

  async function calculateRoutes(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("Comparing eligible routes…");
    setApproved(false);
    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount), sourceCurrency, destinationCurrency,
          destination, preference,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not calculate routes.");
      setQuotes(data.quotes);
      setSelectedRoute(data.quotes[0]?.id ?? "");
      setNotice(data.notice);
    } catch (error) {
      setQuotes([]);
      setNotice(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function connectSolana() {
    setWalletMessage("");
    try {
      if (!window.solana?.connect) {
        setWalletMessage("No compatible Solana browser wallet was detected. Install a wallet that supports the Solana Wallet Standard and try again.");
        return;
      }
      const result = await window.solana.connect();
      const address = result.publicKey.toString();
      setWallets((current) => [...current.filter((wallet) => wallet.address !== address), { network: "Solana", address, name: window.solana?.isPhantom ? "Phantom" : "Solana wallet" }]);
      setWalletMessage("Solana wallet connected in read-only mode.");
    } catch {
      setWalletMessage("Wallet connection was cancelled or could not be completed.");
    }
  }

  async function connectStellar() {
    setWalletMessage("");
    try {
      if (!window.freighterApi) {
        setWalletMessage("Freighter / Varial was not detected. Install the Stellar wallet extension and try again.");
        return;
      }
      const connection = await window.freighterApi.isConnected();
      if (!connection.isConnected) {
        setWalletMessage("Stellar wallet extension is not connected to this browser.");
        return;
      }
      const result = await window.freighterApi.requestAccess();
      if (result.error) throw new Error(result.error.message);
      setWallets((current) => [...current.filter((wallet) => wallet.address !== result.address), { network: "Stellar", address: result.address, name: "Stellar wallet" }]);
      setWalletMessage("Stellar wallet connected in read-only mode.");
    } catch {
      setWalletMessage("Stellar wallet connection was cancelled or could not be completed.");
    }
  }

  function disconnectWallet(address: string) {
    setWallets((current) => current.filter((wallet) => wallet.address !== address));
    setWalletMessage("Wallet disconnected from this session.");
  }

  const nav = [
    { label: "Overview", icon: LayoutDashboard },
    { label: "Payments", icon: ArrowLeftRight },
    { label: "Wallets", icon: Wallet },
    { label: "Activity", icon: Activity },
  ];

  return (
    <main className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#"><span className="brand-symbol">M</span><span>MYRAVEN</span></a>
        <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
        <div className="workspace-card"><span className="workspace-avatar">M</span><span><b>Personal workspace</b><small>MYRAVEN account</small></span><span className="online-dot" /></div>
        <div className="nav-caption">PLATFORM</div>
        <nav className="side-nav">
          {nav.map(({ label, icon: Icon }, index) => <a className={index === 0 ? "active" : ""} href={index === 1 ? "#payment" : index === 2 ? "#wallets" : "#activity"} key={label}><Icon size={17} />{label}{label === "Payments" ? <span className="nav-soon">NEW</span> : null}</a>)}
        </nav>
        <div className="nav-caption tools-caption">TOOLS</div>
        <nav className="side-nav">
          <a href="#payment"><Globe2 size={17} />SmartRoute</a>
          <a href="#safety"><ShieldCheck size={17} />Payment safety</a>
          <a href="#activity"><Bell size={17} />Notifications</a>
          <a href="#settings"><Settings2 size={17} />Settings</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><b>Need a hand?</b><p>Explore how MYRAVEN connects payment methods.</p><a href="#how">Explore platform <ArrowUpRight size={13} /></a></div>
          <div className="profile-row"><span className="profile-avatar">G</span><span><b>Guest workspace</b><small>Preview environment</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div>
          <div className="header-actions"><span className="environment-pill"><i /> SIMULATION</span><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><span className="header-avatar">G</span></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><Sparkles size={13} /> INTELLIGENT PAYMENT ORCHESTRATION</div><h1>Good to see you.</h1><p>Your money, your choices. MYRAVEN connects the routes in between.</p></div>
            <div className="welcome-date"><span>PLATFORM STATUS</span><b><i /> Core preview online</b></div>
          </section>

          <section className="metrics-grid">
            <article className="metric-card"><div className="metric-top"><span>Connected wallets</span><Wallet size={17} /></div><strong>{wallets.length.toString().padStart(2, "0")}</strong><small>Solana + Stellar</small><div className="metric-line purple-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Routes compared</span><ArrowLeftRight size={17} /></div><strong>{quotes.length.toString().padStart(2, "0")}</strong><small>Illustrative route options</small><div className="metric-line cyan-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Payments completed</span><Check size={17} /></div><strong>—</strong><small>No live payments processed</small><div className="metric-line green-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Safety status</span><LockKeyhole size={17} /></div><strong className="metric-word">Protected</strong><small>Approval required for every action</small><div className="metric-line silver-line" /></article>
          </section>

          <div className="work-grid">
            <section className="panel payment-panel" id="payment">
              <div className="panel-heading"><div><span className="panel-kicker">SMARTROUTE ENGINE</span><h2>Build a payment</h2><p>Compare possible routes before making a decision.</p></div><span className="step-badge">01 / 03</span></div>
              <form onSubmit={calculateRoutes}>
                <label className="field-label">YOU SEND</label>
                <div className="amount-field"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" required aria-label="Amount to send" /><select value={sourceCurrency} onChange={(event) => setSourceCurrency(event.target.value)} aria-label="Source currency">{["USD","EUR","GBP","NGN","KES","GHS"].map((currency) => <option key={currency}>{currency}</option>)}</select></div>
                <div className="transfer-connector"><span><ArrowDownLeft size={15} /></span><i /></div>
                <label className="field-label">RECIPIENT GETS</label>
                <div className="recipient-fields"><select value={destinationCurrency} onChange={(event) => setDestinationCurrency(event.target.value)} aria-label="Recipient currency">{["NGN","USD","EUR","GBP","KES","GHS"].map((currency) => <option key={currency}>{currency}</option>)}</select><select value={destination} onChange={(event) => setDestination(event.target.value)} aria-label="Receiving method"><option value="bank">Local bank payout</option><option value="solana">Solana wallet</option><option value="stellar">Stellar wallet</option></select></div>
                <label className="field-label preference-label">ROUTE PRIORITY</label>
                <div className="preference-options">{[{id:"balanced",label:"Balanced"},{id:"lowest-cost",label:"Lowest cost"},{id:"fastest",label:"Fastest"},{id:"most-reliable",label:"Reliability"}].map((option) => <button type="button" className={preference === option.id ? "preference-active" : ""} onClick={() => setPreference(option.id)} key={option.id}>{option.label}</button>)}</div>
                <button className="primary-action" type="submit" disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}{loading ? "Comparing routes…" : "Find best route"}<ArrowUpRight size={16} /></button>
              </form>
              <div className="notice-line"><ShieldCheck size={14} /> No funds move during route comparison.</div>
            </section>

            <section className="panel route-panel">
              <div className="panel-heading"><div><span className="panel-kicker">INTELLIGENCE OUTPUT</span><h2>Route recommendations</h2><p>Ranked by your selected priorities.</p></div><span className="live-indicator"><i /> PREVIEW</span></div>
              {quotes.length === 0 ? <div className="empty-routes"><div className="empty-orbit"><ArrowLeftRight size={23} /></div><b>Your route options will appear here</b><p>Enter a payment amount and select “Find best route” to see a comparison.</p></div> : <div className="route-list">{quotes.map((quote, index) => <button className={`route-option ${selectedRoute === quote.id ? "route-selected" : ""}`} onClick={() => setSelectedRoute(quote.id)} key={quote.id}><span className={`route-icon ${quote.rail}`}>{quote.rail === "solana" ? "S" : quote.rail === "stellar" ? "✦" : "↗"}</span><span className="route-info"><b>{quote.label}{index === 0 ? <em>BEST MATCH</em> : null}</b><small>{quote.estimatedMinutes} min · {quote.reliability}% illustrative reliability</small></span><span className="route-output"><b>{money(quote.recipientAmount, destinationCurrency)}</b><small>Fee {money(quote.estimatedFee, sourceCurrency)}</small></span><span className="route-score">{quote.score}</span></button>)}</div>}
              {quotes.length > 0 ? <div className="route-explanation"><Sparkles size={15} /><span><b>Why this route?</b> {bestQuote?.reasons.join(" · ")}</span></div> : <div className="route-footnote"><span><span className="legend-dot purple" /> Cost</span><span><span className="legend-dot cyan" /> Speed</span><span><span className="legend-dot green" /> Reliability</span></div>}
              {quotes.length > 0 ? <button className="secondary-action" onClick={() => setApprovalOpen(true)}>Review payment details <ArrowUpRight size={15} /></button> : null}
              <p className="simulation-note">{notice}</p>
            </section>
          </div>

          <section className="panel wallet-panel" id="wallets">
            <div className="panel-heading wallet-heading"><div><span className="panel-kicker">CONNECTED ASSETS</span><h2>Wallet connections</h2><p>Connect your Solana or Stellar wallet. Addresses are shown only in this browser session.</p></div><span className="read-only-tag"><LockKeyhole size={12} /> READ ONLY</span></div>
            <div className="wallet-connect-grid">
              <article className="wallet-connect-card"><div className="wallet-network-logo solana-logo">S</div><div className="wallet-copy"><b>Solana</b><small>Phantom and compatible injected wallets</small></div><button onClick={connectSolana} className="connect-button">Connect <Plus size={14} /></button></article>
              <article className="wallet-connect-card"><div className="wallet-network-logo stellar-logo">✦</div><div className="wallet-copy"><b>Stellar</b><small>Freighter / Varial browser wallet</small></div><button onClick={connectStellar} className="connect-button">Connect <Plus size={14} /></button></article>
            </div>
            {walletMessage ? <p className="wallet-message">{walletMessage}</p> : null}
            {wallets.length > 0 ? <div className="connected-list">{wallets.map((wallet) => <div className="connected-wallet" key={wallet.address}><span className={`mini-network ${wallet.network.toLowerCase()}`}>{wallet.network === "Solana" ? "S" : "✦"}</span><span><b>{wallet.name}</b><small>{shortAddress(wallet.address)}</small></span><span className="connected-label"><i /> Connected</span><button onClick={() => disconnectWallet(wallet.address)} className="disconnect-button">Disconnect</button></div>)}</div> : <div className="wallet-empty"><WalletCards size={18} /><span>No wallets connected yet</span></div>}
            <div className="wallet-security"><ShieldCheck size={15} /><span>MYRAVEN never asks for seed phrases or private keys. This preview only requests public wallet addresses; it does not sign or submit transactions.</span></div>
          </section>

          <section className="bottom-grid" id="safety">
            <article className="panel safety-panel"><div className="mini-panel-heading"><span className="safety-icon"><ShieldCheck size={17} /></span><span className="panel-kicker">PAYMENT SAFETY</span></div><h3>You stay in control.</h3><p>Every payment requires a clear review and explicit approval. A quote alone never authorizes a transaction.</p><div className="safety-points"><span><Check size={13} /> Fees shown before approval</span><span><Check size={13} /> No automatic fund movement</span><span><Check size={13} /> No blind payment retries</span></div></article>
            <article className="panel activity-panel" id="activity"><div className="mini-panel-heading"><span className="panel-kicker">RECENT ACTIVITY</span><a href="#activity">View all <ArrowUpRight size={13} /></a></div><div className="activity-empty"><Clock3 size={18} /><span><b>No payment activity yet</b><small>Payment events will appear here when integrations are enabled.</small></span></div></article>
          </section>

          <footer className="app-footer"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Money moves. Intelligence connects.</span><span>Solana · Stellar</span></footer>
        </div>
      </section>

      {menuOpen ? <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}
      {approvalOpen && bestQuote ? <div className="modal-backdrop" role="presentation" onClick={() => setApprovalOpen(false)}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setApprovalOpen(false)} aria-label="Close"><X size={18} /></button><span className="panel-kicker">PAYMENT REVIEW · SIMULATION</span><h2 id="approval-title">Review before you approve</h2><p>This is a preview only. No provider has been contacted and no funds can move.</p><div className="review-rows"><span>You send <b>{money(Number(amount), sourceCurrency)}</b></span><span>Route <b>{bestQuote.label}</b></span><span>Estimated fee <b>{money(bestQuote.estimatedFee, sourceCurrency)}</b></span><span>Recipient receives <b>{money(bestQuote.recipientAmount, destinationCurrency)}</b></span></div>{approved ? <div className="approval-result"><Check size={16} /> Demo approval recorded locally. No transaction was submitted.</div> : <button className="primary-action" onClick={() => setApproved(true)}>Confirm demo approval <Check size={16} /></button>}<button className="cancel-review" onClick={() => setApprovalOpen(false)}>Go back</button></section></div> : null}
    </main>
  );
}
