"use client";

import { useMemo, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bell, Check,
  ChevronDown, CircleHelp, Globe2, LayoutDashboard, LockKeyhole,
  Menu, Plus, RefreshCw,
  Settings2, ShieldCheck, Sparkles, Wallet, WalletCards, X,
} from "lucide-react";

type Quote = {
  id: string; rail: "solana" | "bank"; label: string;
  estimatedFee: number; estimatedMinutes: number; reliability: number;
  recipientAmount: number; score: number; reasons: string[]; simulated: true;
};
type WalletConnection = { network: "Solana"; address: string; name: string };
type DemoActivity = { id: string; title: string; detail: string; amount: string; status: string; time: string };
type RecipientProfile = { myravenId: string; displayName: string | null; countryCode: string | null };

declare global {
  interface Window {
    solana?: { isPhantom?: boolean; connect: () => Promise<{ publicKey: { toString: () => string } }>; disconnect?: () => Promise<void> };
  }
}

const money = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);

const currencyAliases: Record<string, string> = {
  dollar: "USD", dollars: "USD", usd: "USD", euro: "EUR", euros: "EUR", eur: "EUR",
  pound: "GBP", pounds: "GBP", gbp: "GBP", naira: "NGN", ngn: "NGN",
  shilling: "KES", shillings: "KES", kes: "KES", cedi: "GHS", cedis: "GHS", ghs: "GHS",
  franc: "CHF", francs: "CHF", chf: "CHF",
};

function interpretPayAiRequest(prompt: string) {
  const amountMatch = prompt.match(/(?:^|\s)(?:send\s+)?([0-9]+(?:[.,][0-9]{1,2})?)/i);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", ".")) : null;
  const normalized = prompt.toLowerCase();
  const currencyMatch = normalized.match(/\b(usd|eur|gbp|ngn|kes|ghs|chf|dollars?|euros?|pounds?|naira|shillings?|cedis?|francs?)\b/);
  const currency = currencyMatch ? currencyAliases[currencyMatch[1]] : null;
  const recipientMatch = prompt.match(/\bto\s+(.+?)(?:\s+(?:in|who|with|using|via|should|gets)\b|[,.]|$)/i);
  const recipient = recipientMatch?.[1]?.trim() ?? "";
  const destinationCurrency = /\b(naira|ngn)\b/i.test(prompt) ? "NGN"
    : /\b(dollars?|usd)\b/i.test(prompt) ? "USD"
    : /\b(euros?|eur)\b/i.test(prompt) ? "EUR"
    : /\b(pounds?|gbp)\b/i.test(prompt) ? "GBP"
    : /\b(kes|shillings?)\b/i.test(prompt) ? "KES"
    : /\b(ghs|cedis?)\b/i.test(prompt) ? "GHS" : null;
  const destination = /\b(wallet|solana|address)\b/i.test(prompt) ? "solana" : "bank";
  return { amount, currency, destinationCurrency, destination, recipient };
}

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
  const [payAiOpen, setPayAiOpen] = useState(false);
  const [payAiPrompt, setPayAiPrompt] = useState("");
  const [payAiMessage, setPayAiMessage] = useState("");
  const [recipientReference, setRecipientReference] = useState("");
  const [recipientType, setRecipientType] = useState("myraven");
  const [recipientCountry, setRecipientCountry] = useState("NG");
  const [recipientBank, setRecipientBank] = useState("");
  const [recipientBankAccount, setRecipientBankAccount] = useState("");
  const [recipientProfile, setRecipientProfile] = useState<RecipientProfile | null>(null);
  const [recipientLookupStatus, setRecipientLookupStatus] = useState("");
  const [recipientLookupLoading, setRecipientLookupLoading] = useState(false);
  const [activities, setActivities] = useState<DemoActivity[]>([]);
  const [fundingMethod, setFundingMethod] = useState("card");
  const [fundingCurrency, setFundingCurrency] = useState("USD");
  const [fundingAmount, setFundingAmount] = useState("100");
  const [fundingAsset, setFundingAsset] = useState("SOL");
  const [fundingNotice, setFundingNotice] = useState("");
  const [ussdPhone, setUssdPhone] = useState("");
  const [ussdAmount, setUssdAmount] = useState("25");
  const [ussdResult, setUssdResult] = useState("");

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
    try {
      if (!window.solana?.isPhantom) {
        setWalletMessage("Phantom wallet was not detected. You can still explore MYRAVEN; provider-based deposits are not connected yet.");
        return;
      }
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWallets([{ network: "Solana", address, name: "Connected Solana wallet" }]);
      setWalletMessage("Solana wallet connected for public-address verification only. No transaction was signed or submitted.");
    } catch {
      setWalletMessage("Wallet connection was cancelled or unavailable.");
    }
  }

  async function verifyRecipient() {
    const reference = recipientReference.trim();
    setRecipientProfile(null);
    setRecipientLookupStatus("");
    if (!reference) {
      setRecipientLookupStatus("Enter a recipient identifier first.");
      return;
    }

    if (recipientType === "local-bank") {
      setRecipientLookupStatus("Bank directory and account-name verification require a connected payout provider. No bank has been selected or verified yet.");
      return;
    }

    if (recipientType === "myraven") {
      setRecipientLookupLoading(true);
      try {
        const response = await fetch("/api/recipients/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ myravenId: reference }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Recipient lookup failed.");
        setRecipientProfile(data.recipient);
        setRecipientLookupStatus("MYRAVEN profile matched. Check the displayed name and ID before continuing.");
      } catch (error) {
        setRecipientLookupStatus(error instanceof Error ? error.message : "Recipient lookup failed.");
      } finally {
        setRecipientLookupLoading(false);
      }
      return;
    }

    if (recipientType === "solana") {
      const base58Address = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(reference);
      setRecipientLookupStatus(base58Address
        ? "Address format looks valid, but the wallet owner is unverified. Confirm the full address independently."
        : "That does not look like a valid Solana address. Check the full address and try again.");
      return;
    }

    setRecipientLookupStatus("MYRAVEN account-number lookup is not connected yet. Use a MYRAVEN ID for profile matching.");
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

  async function prepareDeposit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(fundingAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setFundingNotice("Enter a valid deposit amount.");
      return;
    }
    try {
      const response = await fetch("/api/funding/readiness");
      const readiness = await response.json();
      if (!response.ok) throw new Error("Could not check funding readiness.");
      setFundingNotice(`${value.toLocaleString()} ${fundingCurrency} via ${fundingMethod.replaceAll("_", " ")} selected for ${fundingAsset} on Solana. ${readiness.message} No payment has been initiated and no funds have moved.`);
    } catch {
      setFundingNotice("Funding readiness could not be checked. No payment has been initiated and no funds have moved.");
    }
  }
  function simulateUssd() {
    if (!/^\+?[0-9]{7,15}$/.test(ussdPhone.replace(/[\s-]/g, ""))) {
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
    { label: "USSD Preview", icon: Globe2 },
  ];

  return (
    <main className="app-frame">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#" aria-label="MYRAVEN home">
          <span className="brand-orbit-lockup">
            <svg className="brand-orbit-art" viewBox="0 0 240 72" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="word-orbit-metal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#F4F1FF"/><stop offset=".42" stopColor="#B8A5FF"/><stop offset=".72" stopColor="#67E8F9"/><stop offset="1" stopColor="#E7EAF4"/></linearGradient>
                <linearGradient id="word-orbit-violet" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#7C3AED"/><stop offset=".52" stopColor="#C4B5FD"/><stop offset="1" stopColor="#E9D5FF"/></linearGradient>
                <linearGradient id="word-orbit-cyan" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#67E8F9"/><stop offset="1" stopColor="#A5F3FC"/></linearGradient>
                <radialGradient id="orbit-planet-violet"><stop stopColor="#FFF"/><stop offset=".35" stopColor="#D8C8FF"/><stop offset="1" stopColor="#8057E8"/></radialGradient>
                <radialGradient id="orbit-planet-cyan"><stop stopColor="#FFF"/><stop offset=".38" stopColor="#A5F3FC"/><stop offset="1" stopColor="#159DB8"/></radialGradient>
              </defs>
              <g className="orbit-plane orbit-plane-back" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="105" ry="25" stroke="url(#word-orbit-violet)" strokeWidth="1.25" opacity=".72"/>
                <circle r="3.1" fill="url(#orbit-planet-violet)" stroke="#E9D5FF" strokeWidth=".55">
                  <animateMotion dur="13s" repeatCount="indefinite" path="M15 36 A105 25 0 1 1 225 36 A105 25 0 1 1 15 36"/>
                </circle>
              </g>
              <g className="orbit-plane orbit-plane-mid" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="99" ry="18" stroke="url(#word-orbit-metal)" strokeWidth="1.45" opacity=".85"/>
                <circle r="2.7" fill="url(#orbit-planet-cyan)" stroke="#CFFAFE" strokeWidth=".5">
                  <animateMotion dur="9s" repeatCount="indefinite" path="M21 36 A99 18 0 1 0 219 36 A99 18 0 1 0 21 36"/>
                </circle>
              </g>
              <g className="orbit-plane orbit-plane-front" fill="none" strokeLinecap="round">
                <ellipse cx="120" cy="36" rx="108" ry="13" stroke="url(#word-orbit-cyan)" strokeWidth="1.15" opacity=".8"/>
                <circle r="2.4" fill="url(#orbit-planet-violet)" stroke="#E9D5FF" strokeWidth=".45">
                  <animateMotion dur="17s" repeatCount="indefinite" path="M12 36 A108 13 0 1 1 228 36 A108 13 0 1 1 12 36"/>
                </circle>
              </g>
            </svg>
            <span className="brand-wordmark">MYRAVEN</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE <ChevronDown size={13} /></div>
        <div className="workspace-card"><span className="workspace-avatar">M</span><span><b>Personal workspace</b><small>MYRAVEN account</small></span><span className="online-dot" /></div>
        <div className="nav-caption">PLATFORM</div>
        <nav className="side-nav">
          {nav.map(({ label, icon: Icon }, index) => <a className={index === 0 ? "active" : ""} href={index === 1 ? "#payment" : index === 2 ? "#wallets" : index === 3 ? "#activity" : "#ussd"} key={label}><Icon size={17} />{label}{label === "Payments" ? <span className="nav-soon">NEW</span> : null}</a>)}
        </nav>
        <div className="nav-caption tools-caption">TOOLS</div>
        <nav className="side-nav">
          <a href="#funding"><WalletCards size={17} />Add funds</a>
          <a href="#payment"><Globe2 size={17} />SmartRoute</a>
          <a href="#safety"><ShieldCheck size={17} />Payment safety</a>
          <a href="#ussd"><Globe2 size={17} />USSD simulator</a>
          <a href="#activity"><Bell size={17} />Notifications</a>
          <a href="#settings"><Settings2 size={17} />Settings</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><span className="help-icon"><CircleHelp size={16} /></span><b>Need a hand?</b><p>Explore how MYRAVEN connects payment methods.</p><a href="#how">Explore platform <ArrowUpRight size={13} /></a></div>
          <a className="profile-row" href="/account"><span className="profile-avatar">M</span><span><b>MYRAVEN account</b><small>Sign in or manage profile</small></span><ChevronDown size={15} /></a>
        </div>
      </aside>

      <section className="main-area">
        <header className="top-header">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu"><Menu size={19} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <b>Overview</b></div>
          <div className="header-actions"><span className="environment-pill"><i /> PREVIEW MODE</span><a className="account-link" href="/account">My account <ArrowUpRight size={14} /></a><button className="icon-button" aria-label="Notifications"><Bell size={17} /></button><span className="header-avatar">M</span></div>
        </header>

        <div className="content-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><Sparkles size={13} /> INTELLIGENT PAYMENT ORCHESTRATION</div><h1>Good to see you.</h1><p>Your money, your choices. MYRAVEN connects the routes in between.</p></div>
            <div className="welcome-date"><span>PLATFORM STATUS</span><b><i /> Core preview online</b></div>
          </section>

          <section className="metrics-grid">
            <article className="metric-card"><div className="metric-top"><span>Connected wallets</span><Wallet size={17} /></div><strong>{wallets.length.toString().padStart(2, "0")}</strong><small>Solana network only</small><div className="metric-line purple-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Routes compared</span><ArrowLeftRight size={17} /></div><strong>{quotes.length.toString().padStart(2, "0")}</strong><small>Illustrative route options</small><div className="metric-line cyan-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Payments completed</span><Check size={17} /></div><strong>{activities.filter((item) => item.status.includes("Completed")).length.toString().padStart(2, "0")}</strong><small>Demo transactions only</small><div className="metric-line green-line" /></article>
            <article className="metric-card"><div className="metric-top"><span>Safety status</span><LockKeyhole size={17} /></div><strong className="metric-word">Protected</strong><small>Approval required for every action</small><div className="metric-line silver-line" /></article>
          </section>

          <div className="work-grid">
            <section className="panel payment-panel" id="payment">
              <div className="panel-heading"><div><span className="panel-kicker">SMARTROUTE ENGINE</span><h2>Build a payment</h2><p>Compare possible routes before making a decision.</p></div><div className="payment-heading-actions"><button type="button" className={payAiOpen ? "pay-ai-trigger pay-ai-active" : "pay-ai-trigger"} onClick={() => setPayAiOpen((open) => !open)}><Sparkles size={13} /> Pay AI</button><span className="step-badge">01 / 03</span></div></div>
              {payAiOpen ? <div className="pay-ai-box">
                <div className="pay-ai-title"><span className="pay-ai-orb"><Sparkles size={13} /></span><span><b>Pay AI</b><small>Transfer assistant · Preview</small></span></div>
                <p>Describe the transfer. I’ll prepare the amount, currencies and recipient reference for you to review.</p>
                <textarea value={payAiPrompt} onChange={(event) => setPayAiPrompt(event.target.value)} placeholder="e.g. Send 100 CHF to Daniel in Nigeria. He should receive naira in his bank." rows={3} />
                <button type="button" className="pay-ai-submit" onClick={() => {
                  const parsed = interpretPayAiRequest(payAiPrompt);
                  const updates: string[] = [];
                  if (parsed.amount && Number.isFinite(parsed.amount) && parsed.amount > 0) { setAmount(String(parsed.amount)); updates.push("amount"); }
                  if (parsed.currency && ["USD","EUR","GBP","NGN","KES","GHS","CHF"].includes(parsed.currency)) { setSourceCurrency(parsed.currency); updates.push("your currency"); }
                  if (parsed.destinationCurrency) { setDestinationCurrency(parsed.destinationCurrency); updates.push("recipient currency"); }
                  if (parsed.destination) setDestination(parsed.destination);
                  if (parsed.recipient) { setRecipientReference(parsed.recipient); updates.push("recipient reference"); }
                  setPayAiMessage(updates.length ? "Prepared " + updates.join(", ") + ". Check every detail below, then calculate a route. This assistant preview does not identify or contact a real recipient." : "I couldn’t confidently identify the amount or currencies. Include an amount and currency, for example: “Send 100 CHF to Daniel in Nigeria, paid out in NGN.”");
                }}>Prepare transfer <ArrowUpRight size={13} /></button>
                {payAiMessage ? <div className="pay-ai-feedback">{payAiMessage}</div> : null}
                <small className="pay-ai-disclaimer">Assisted form parsing only. Live AI, recipient lookup and payment execution are not connected yet.</small>
              </div> : null}
              <form onSubmit={calculateRoutes}>
                <label className="field-label">YOU SEND</label>
                <div className="amount-field"><input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" required aria-label="Amount to send" /><select value={sourceCurrency} onChange={(event) => setSourceCurrency(event.target.value)} aria-label="Source currency">{["USD","EUR","GBP","CHF","NGN","KES","GHS"].map((currency) => <option key={currency}>{currency}</option>)}</select></div>
                <div className="transfer-connector"><span><ArrowDownLeft size={15} /></span><i /></div>
                <label className="field-label">RECIPIENT GETS</label>
                <select className="recipient-method-select" value={recipientType} onChange={(event) => { setRecipientType(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); setRecipientReference(""); setRecipientBank(""); setRecipientBankAccount(""); setRecipientLookupStatus(""); setDestination(event.target.value === "local-bank" ? "bank" : "solana"); }} aria-label="Recipient destination">
                  <option value="solana">SOL address</option>
                  <option value="myraven">MYRAVEN ID</option>
                  <option value="account">MYRAVEN account number</option>
                  <option value="local-bank">Local bank / payment</option>
                </select>
                <label className="field-label preference-label">RECIPIENT IDENTIFIER</label>
                {recipientType === "local-bank" ? <div className="local-bank-fields">
                  <label className="field-label">RECIPIENT COUNTRY</label>
                  <select value={recipientCountry} onChange={(event) => { setRecipientCountry(event.target.value); setRecipientBank(""); setRecipientLookupStatus(""); }} aria-label="Recipient country">
                    <option value="NG">Nigeria</option><option value="GH">Ghana</option><option value="KE">Kenya</option><option value="ZA">South Africa</option><option value="GB">United Kingdom</option><option value="US">United States</option><option value="CH">Switzerland</option><option value="EU">Euro area</option>
                  </select>
                  <label className="field-label">BANK / PAYMENT PROVIDER</label>
                  <select value={recipientBank} onChange={(event) => { setRecipientBank(event.target.value); setRecipientLookupStatus(""); }} aria-label="Recipient bank" disabled><option value="">Bank list loads from connected payout providers</option></select>
                  <label className="field-label">RECIPIENT ACCOUNT NUMBER</label>
                  <input value={recipientBankAccount} onChange={(event) => { setRecipientBankAccount(event.target.value); setRecipientLookupStatus(""); }} placeholder="Enter recipient account number" aria-label="Recipient bank account number" />
                  <p className="recipient-lookup-status">Country selection is a preview. Live bank lists and account-name verification will appear when a payout provider is connected.</p>
                </div> : <div className="recipient-lookup-row">
                  <input className="recipient-reference-input" value={recipientReference} onChange={(event) => { setRecipientReference(event.target.value); setRecipientProfile(null); setRecipientLookupStatus(""); }} placeholder={recipientType === "myraven" ? "MRV-XXXXXXXXXX" : recipientType === "account" ? "MYRAVEN account number" : "Paste Solana address"} aria-label="Recipient identifier" />
                </div>}
                {recipientType !== "local-bank" ? <button type="button" className="verify-recipient-button" onClick={verifyRecipient} disabled={recipientLookupLoading}>
                  <ShieldCheck size={13} /> {recipientLookupLoading ? "Checking recipient…" : recipientType === "solana" ? "Validate SOL address" : "Verify recipient"}
                </button> : <button type="button" className="verify-recipient-button" onClick={verifyRecipient}><ShieldCheck size={13} /> Check bank details</button>}
                {recipientProfile ? <div className="recipient-verification-card">
                  <div className="recipient-avatar">{(recipientProfile.displayName || "M").slice(0, 1).toUpperCase()}</div>
                  <div className="recipient-verification-copy">
                    <b>{recipientProfile.displayName || "MYRAVEN user"}</b>
                    <small>{recipientProfile.myravenId}{recipientProfile.countryCode ? " · " + recipientProfile.countryCode : ""}</small>
                    <em><Check size={11} /> MYRAVEN profile matched</em>
                  </div>
                </div> : null}
                {recipientLookupStatus ? <p className={recipientProfile ? "recipient-lookup-status verified" : "recipient-lookup-status"} role="status">{recipientLookupStatus}</p> : null}
                <label className="field-label preference-label">ROUTE PRIORITY</label>
                <div className="preference-options">{[{id:"balanced",label:"Balanced"},{id:"lowest-cost",label:"Lowest cost"},{id:"fastest",label:"Fastest"},{id:"most-reliable",label:"Reliability"}].map((option) => <button type="button" className={preference === option.id ? "preference-active" : ""} onClick={() => setPreference(option.id)} key={option.id}>{option.label}</button>)}</div>
                <button className="primary-action" type="submit" disabled={loading}>{loading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}{loading ? "Comparing routes…" : "Find best route"}<ArrowUpRight size={16} /></button>
              </form>
              <div className="notice-line"><ShieldCheck size={14} /> No funds move during route comparison.</div>
            </section>

            <section className="panel route-panel">
              <div className="panel-heading"><div><span className="panel-kicker">INTELLIGENCE OUTPUT</span><h2>Route recommendations</h2><p>Ranked by your selected priorities.</p></div><span className="live-indicator"><i /> PREVIEW</span></div>
              {quotes.length === 0 ? <div className="empty-routes"><div className="empty-orbit"><ArrowLeftRight size={23} /></div><b>Your route options will appear here</b><p>Enter a payment amount and select “Find best route” to see a comparison.</p></div> : <div className="route-list">{quotes.map((quote, index) => <button className={`route-option ${selectedRoute === quote.id ? "route-selected" : ""}`} onClick={() => setSelectedRoute(quote.id)} key={quote.id}><span className={`route-icon ${quote.rail}`}>{quote.rail === "solana" ? "S" : "↗"}</span><span className="route-info"><b>{quote.label}{index === 0 ? <em>BEST MATCH</em> : null}</b><small>{quote.estimatedMinutes} min · {quote.reliability}% illustrative reliability</small></span><span className="route-output"><b>{money(quote.recipientAmount, destinationCurrency)}</b><small>Fee {money(quote.estimatedFee, sourceCurrency)}</small></span><span className="route-score">{quote.score}</span></button>)}</div>}
              {quotes.length > 0 ? <div className="route-explanation"><Sparkles size={15} /><span><b>Why this route?</b> {bestQuote?.reasons.join(" · ")}</span></div> : <div className="route-footnote"><span><span className="legend-dot purple" /> Cost</span><span><span className="legend-dot cyan" /> Speed</span><span><span className="legend-dot green" /> Reliability</span></div>}
              {quotes.length > 0 ? <button className="secondary-action" onClick={() => setApprovalOpen(true)}>Review payment details <ArrowUpRight size={15} /></button> : null}
              <p className="simulation-note">{notice}</p>
            </section>
          </div>

          <section className="panel wallet-panel" id="funding">
            <div className="panel-heading wallet-heading"><div><span className="panel-kicker">UNIFIED FUNDING ENGINE</span><h2>Add money to MYRAVEN</h2><p>Pay with a supported local currency or crypto. MYRAVEN is designed to settle supported deposits into Solana assets.</p></div><span className="read-only-tag"><ShieldCheck size={12} /> PROVIDER SETUP</span></div>
            <form onSubmit={prepareDeposit}>
              <div className="recipient-fields">
                <select value={fundingMethod} onChange={(event) => setFundingMethod(event.target.value)} aria-label="Funding method"><option value="card">Debit / credit card</option><option value="bank_transfer">Bank transfer</option><option value="crypto_wallet">Crypto wallet</option><option value="local_payment">Local payment method</option></select>
                <div className="amount-field"><input value={fundingAmount} onChange={(event) => setFundingAmount(event.target.value)} type="number" min="0.01" step="0.01" required aria-label="Deposit amount" /><select value={fundingCurrency} onChange={(event) => setFundingCurrency(event.target.value)} aria-label="Funding currency"><option>USD</option><option>EUR</option><option>GBP</option><option>NGN</option><option>KES</option><option>GHS</option><option>CHF</option><option>CAD</option><option>AUD</option><option>BTC</option><option>ETH</option><option>USDC</option><option>SOL</option></select></div>
              </div>
              <div className="recipient-fields" style={{ marginTop: 12 }}>
                <div><label className="field-label">SETTLEMENT NETWORK</label><div className="amount-field"><span style={{ color: "#b9a4ff", fontSize: 12, fontWeight: 700 }}>SOLANA</span></div></div>
                <div><label className="field-label">MYRAVEN ASSET</label><select value={fundingAsset} onChange={(event) => setFundingAsset(event.target.value)} aria-label="Solana settlement asset"><option value="SOL">SOL on Solana</option></select></div>
              </div>
              <button className="primary-action" type="submit"><WalletCards size={16} /> Prepare deposit <ArrowUpRight size={16} /></button>
              {fundingNotice ? <p className="ussd-result">{fundingNotice}</p> : <div className="notice-line"><ShieldCheck size={14} /> Provider checkout is not connected yet. This form does not charge or transfer funds.</div>}
            </form>
          </section>
          <section className="panel wallet-panel" id="wallets">
            <div className="panel-heading wallet-heading"><div><span className="panel-kicker">CONNECTED ASSETS</span><h2>Wallet connections</h2><p>Connect a Solana wallet to verify its public address. MYRAVEN never asks for your seed phrase.</p></div><span className="read-only-tag"><ShieldCheck size={12} /> ADDRESS ONLY</span></div>
            <div className="wallet-connect-grid">
              <article className="wallet-connect-card"><div className="wallet-network-logo solana-logo">S</div><div className="wallet-copy"><b>Solana</b><small>Phantom-compatible · Public address only</small></div><button onClick={connectSolana} className="connect-button">Connect wallet <Plus size={14} /></button></article>
              
            </div>
            {walletMessage ? <p className="wallet-message">{walletMessage}</p> : null}
            {wallets.length > 0 ? <div className="connected-list">{wallets.map((wallet) => <div className="connected-wallet" key={wallet.address}><span className={`mini-network ${wallet.network.toLowerCase()}`}>S</span><span><b>{wallet.name}</b><small>{shortAddress(wallet.address)}</small></span><span className="connected-label"><i /> Connected</span><button onClick={() => disconnectWallet(wallet.address)} className="disconnect-button">Disconnect</button></div>)}</div> : <div className="wallet-empty"><WalletCards size={18} /><span>No wallets connected yet</span></div>}
            <div className="wallet-balance-note"><Wallet size={15} /><span>Your verified SOL balance will appear here after a confirmed deposit is posted to your MYRAVEN ledger. No sample balance is displayed.</span></div>
            <div className="wallet-security"><ShieldCheck size={15} /><span>Wallet connection verifies only your public address. No transaction is signed, and MYRAVEN never requests your seed phrase or private key.</span></div>
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
            <article className="panel activity-panel" id="activity"><div className="mini-panel-heading"><span className="panel-kicker">RECENT ACTIVITY</span><a href="#activity">View all <ArrowUpRight size={13} /></a></div><div className="demo-activity-list">{activities.length ? activities.map((item) => <div className="demo-activity-item" key={item.id}><span className="activity-mark"><ArrowLeftRight size={14} /></span><span className="activity-description"><b>{item.title}</b><small>{item.detail} · {item.time}</small></span><span className="activity-amount"><b>{item.amount}</b><small>{item.status}</small></span></div>) : <div className="activity-empty"><Activity size={17} /><span><b>No activity yet</b><small>Verified deposits and real transaction events will appear here. Preview approvals stay clearly labelled.</small></span></div>}</div></article>
          </section>

          <footer className="app-footer"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Money moves. Intelligence connects.</span><span>Preview · Solana only</span></footer>
        </div>
      </section>

      {menuOpen ? <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /> : null}
      {approvalOpen && bestQuote ? <div className="modal-backdrop" role="presentation" onClick={() => setApprovalOpen(false)}><section className="approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setApprovalOpen(false)} aria-label="Close"><X size={18} /></button><span className="panel-kicker">PAYMENT REVIEW · SIMULATION</span><h2 id="approval-title">Review before you approve</h2><p>This is a preview only. No provider has been contacted and no funds can move.</p><div className="review-rows"><span>Recipient <b>{recipientProfile?.displayName ?? (recipientType === "solana" ? "External Solana wallet" : "Not verified")}</b></span><span>Recipient check <b>{recipientProfile ? "MYRAVEN profile matched" : recipientLookupStatus || "Not checked"}</b></span><span>Identifier <b>{recipientReference || "Not provided"}</b></span><span>You send <b>{money(Number(amount), sourceCurrency)}</b></span><span>Route <b>{bestQuote.label}</b></span><span>Estimated fee <b>{money(bestQuote.estimatedFee, sourceCurrency)}</b></span><span>Recipient receives <b>{money(bestQuote.recipientAmount, destinationCurrency)}</b></span></div>{approved ? <div className="approval-result"><Check size={16} /> Demo approval recorded locally. No transaction was submitted.</div> : <button className="primary-action" onClick={confirmDemoPayment}>Confirm demo approval <Check size={16} /></button>}<button className="cancel-review" onClick={() => setApprovalOpen(false)}>Go back</button></section></div> : null}
    </main>
  );
}
