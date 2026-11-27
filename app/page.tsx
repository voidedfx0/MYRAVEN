"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, CircleHelp, Globe2, LayoutDashboard, LockKeyhole,
  Menu, Plus, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Wallet, WalletCards, X,
} from "lucide-react";

type Quote = {
  id: string; rail: "solana" | "stellar" | "bank"; label: string;
  estimatedFee: number; estimatedMinutes: number; reliability: number;
  recipientAmount: number; score: number; reasons: string[]; simulated: true;
};
type WalletConnection = { network: "Solana" | "Stellar"; address: string; name: string };\ntype DemoActivity = { id: string; title: string; detail: string; amount: string; status: string; time: string };

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
  const [approved, setApproved] = useState(false);\n  const [activities, setActivities] = useState<DemoActivity[]>([\n    { id: "MRV-DEMO-001", title: "Demo wallet funded", detail: "Solana · USDC", amount: "+250.00 USDC", status: "Completed · Demo", time: "Today · 09:42" },\n    { id: "MRV-DEMO-002", title: "Demo conversion", detail: "Stellar · XLM → USDC", amount: "125.00 USDC", status: "Completed · Demo", time: "Today · 08:16" },\n  ]);\n  const [ussdPhone, setUssdPhone] = useState("");\n  const [ussdAmount, setUssdAmount] = useState("25");\n  const [ussdResult, setUssdResult] = useState("");

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
    const address = "7xKX...demoSOL...9vP2";
    setWallets((current) => [...current.filter((wallet) => wallet.network !== "Solana"), { network: "Solana", address, name: "Solana demo wallet" }]);
    setWalletMessage("Demo Solana wallet connected. Sample assets only; no real wallet was contacted.");
  }

  async function connectStellar() {
    const address = "GDEMO...STELLAR...4RAV";
    setWallets((current) => [...current.filter((wallet) => wallet.network !== "Stellar"), { network: "Stellar", address, name: "Stellar demo wallet" }]);
    setWalletMessage("Demo Stellar wallet connected. Sample assets only; no real wallet was contacted.");
  }

  function confirmDemoPayment() {
    if (!bestQuote) return;
    const id = "MRV-" + String(activities.length + 3).padStart(6, "0");
    setActivities((current) => [{
      id,
      title: "Demo payment sent",
      detail: bestQuote.label + " · " + destinationCurrency,
      amount: "-" + money(Number(amount), sourceCurrency),
      status: "Completed · Demo",
      time: "Just now",
    }, ...current]);
    setApproved(true);
  }

  function simulateUssd() {
    if (!/^\\+?[0-9]{7,15}$/.test(ussdPhone.replace(/[\\s-]/g, ""))) {
      setUssdResult("Enter a valid demo phone number (7–15 digits).");
      return;
    }
    const parsedAmount = Number(ussdAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setUssdResult("Enter a valid amount.");
      return;
    }
    setUssdResult("Demo USSD request created for " + ussdPhone + ". No telecom, bank or wallet was contacted.");
    setActivities((current) => [{
      id: "MRV-USSD-" + String(current.length + 1).padStart(4, "0"),
      title: "USSD send simulation",
      detail: "Recipient " + shortAddress(ussdPhone),
      amount: "-" + money(parsedAmount, "USD"),
      status: "Simulated · Awaiting demo confirmation",
      time: "Just now",
    }, ...current]);
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
          <div className="profile-row"><span className="profile-avatar">D</span><span><b>Demo workspace</b><small>Sample data environment</small></span><ChevronDown size={15} /></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div>
          <div className="header-actions"><span className="environment-pill"><i /> DEMO MODE</span><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><span className="header-avatar">D</span></div>
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
            <div className="panel-heading wallet-heading"><div><span className="panel-kicker">CONNECTED ASSETS</span><h2>Wallet connections</h2><p>Explore sample Solana and Stellar wallets, balances and assets. Nothing connects to a real wallet.</p></div><span className="read-only-tag"><Sparkles size={12} /> DEMO DATA</span></div>
            <div className="wallet-connect-grid">
              <article className="wallet-connect-card"><div className="wallet-network-logo solana-logo">S</div><div className="wallet-copy"><b>Solana</b><small>Simulated wallet · Sample SOL and SPL assets</small></div><button onClick={connectSolana} className="connect-button">Add demo <Plus size={14} /></button></article>
              <article className="wallet-connect-card"><div className="wallet-network-logo stellar-logo">✦</div><div className="wallet-copy"><b>Stellar</b><small>Simulated wallet · Sample XLM and Stellar assets</small></div><button onClick={connectStellar} className="connect-button">Connect <Plus size={14} /></button></article>
            </div>
            {walletMessage ? <p className="wallet-message">{walletMessage}</p> : null}
            {wallets.length > 0 ? <div className="connected-list">{wallets.map((wallet) => <div className="connected-wallet" key={wallet.address}><span className={`mini-network ${wallet.network.toLowerCase()}`}>{wallet.network === "Solana" ? "S" : "✦"}</span><span><b>{wallet.name}</b><small>{shortAddress(wallet.address)}</small></span><span className="connected-label"><i /> Connected</span><button onClick={() => disconnectWallet(wallet.address)} className="disconnect-button">Disconnect</button></div>)}</div> : <div className="wallet-empty"><WalletCards size={18} /><span>No wallets connected yet</span></div>}
            <div className="demo-assets-grid">
              <article className="demo-asset"><span className="asset-symbol solana-logo">◎</span><span><b>SOL</b><small>Solana · Demo balance</small></span><strong>12.4500</strong><em>≈ $1,867.50</em></article>
              <article className="demo-asset"><span className="asset-symbol stellar-logo">✦</span><span><b>XLM</b><small>Stellar · Demo balance</small></span><strong>4,820.00</strong><em>≈ $578.40</em></article>
              <article className="demo-asset"><span className="asset-symbol usdc-symbol">$</span><span><b>USDC</b><small>Solana · Demo balance</small></span><strong>2,450.00</strong><em>≈ $2,450.00</em></article>
              <article className="demo-asset"><span className="asset-symbol usdc-symbol">$</span><span><b>USDC</b><small>Stellar · Demo balance</small></span><strong>680.00</strong><em>≈ $680.00</em></article>
            </div>
            <div className="wallet-security"><ShieldCheck size={15} /><span>All balances, wallet addresses and asset valuations above are fictional demo data. No real wallets are contacted and no seed phrases or private keys are requested.</span></div>
          </section>

          <section className="panel ussd-panel" id="ussd">
            <div className="panel-heading"><div><span className="panel-kicker">INCLUSIVE PAYMENTS · DEMO</span><h2>USSD payment simulator</h2><p>Preview how a basic-phone user could start a payment without a smartphone app.</p></div><span className="step-badge">*384#</span></div>
            <div className="ussd-layout"><div className="ussd-phone"><div className="ussd-phone-top">MYRAVEN MOBILE</div><div className="ussd-screen"><b>MYRAVEN</b><span>1. Send money</span><span>2. Check balance</span><span>3. Receive money</span><span>4. Help</span><small>Demo USSD menu · No carrier connection</small></div><div className="ussd-keypad">1　 2　 3<br/>4　 5　 6<br/>7　 8　 9<br/>*　 0　 #</div></div>
              <div className="ussd-form"><label className="field-label">RECIPIENT PHONE</label><input value={ussdPhone} onChange={(event) => setUssdPhone(event.target.value)} placeholder="+234 800 000 0000" />
                <label className="field-label">AMOUNT (USD DEMO)</label><input type="number" min="0.01" value={ussdAmount} onChange={(event) => setUssdAmount(event.target.value)} />
                <button className="primary-action" onClick={simulateUssd}>Simulate USSD request <ArrowUpRight size={15} /></button>
                {ussdResult ? <p className="ussd-result">{ussdResult}</p> : null}
              </div>
            </div>
          </section>

          <section className="bottom-grid" id="safety">
            <article className="panel safety-panel"><div className="mini-panel-heading"><span className="safety-icon"><ShieldCheck size={17} /></span><span className="panel-kicker">PAYMENT SAFETY</span></div><h3>You stay in control.</h3><p>Every payment requires a clear review and explicit approval. A quote alone never authorizes a transaction.</p><div className="safety-points"><span><Check size={13} /> Fees shown before approval</span><span><Check size={13} /> No automatic fund movement</span><span><Check size={13} /> No blind payment retries</span></div></article>
            <article className="panel activity-panel" id="activity"><div className="mini-panel-heading"><span className="panel-kicker">RECENT ACTIVITY</span><a href="#activity">View all <ArrowUpRight size={13} /></a></div><div className="demo-activity-list">{activities.map((item) => <div className="demo-activity-item" key={item.id}><span className="activity-mark"><ArrowLeftRight size={14} /></span><span className="activity-description"><b>{item.title}</b><small>{item.detail} · {item.time}</small></span><span className="activity-amount"><b>{item.amount}</b><small>{item.status}</small></span></div>)}</div></article>
          </section>

          <footer className="app-footer"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Money moves. Intelligence connects.</span><span>Demo only · Solana · Stellar</span></footer>
        </div>
      </section>

      {menuOpen ? <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}
      {approvalOpen && bestQuote ? <div className="modal-backdrop" role="presentation" onClick={() => setApprovalOpen(false)}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setApprovalOpen(false)} aria-label="Close"><X size={18} /></button><span className="panel-kicker">PAYMENT REVIEW · SIMULATION</span><h2 id="approval-title">Review before you approve</h2><p>This is a preview only. No provider has been contacted and no funds can move.</p><div className="review-rows"><span>You send <b>{money(Number(amount), sourceCurrency)}</b></span><span>Route <b>{bestQuote.label}</b></span><span>Estimated fee <b>{money(bestQuote.estimatedFee, sourceCurrency)}</b></span><span>Recipient receives <b>{money(bestQuote.recipientAmount, destinationCurrency)}</b></span></div>{approved ? <div className="approval-result"><Check size={16} /> Demo approval recorded locally. No transaction was submitted.</div> : <button className="primary-action" onClick={confirmDemoPayment}>Confirm demo approval <Check size={16} /></button>}<button className="cancel-review" onClick={() => setApprovalOpen(false)}>Go back</button></section></div> : null}
    </main>
  );
}
