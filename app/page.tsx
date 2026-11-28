import Link from "next/link";
import AuthActions from "@/components/auth-actions";
import {
  ArrowDown, ArrowUpRight, Wallet, Globe2, ShieldCheck, Sparkles,
  ArrowLeftRight, Building2, CircleDollarSign, CreditCard,
  Smartphone, QrCode, RefreshCw, Bell, ReceiptText, Fingerprint,
  BadgeCheck, Route, Landmark, Activity, LockKeyhole, ScanLine
} from "lucide-react";

const products = [
  { n: "01", tag: "FUND", icon: Wallet, title: "Fund your account", copy: "A single starting point for supported bank, card, mobile-money and crypto funding methods." },
  { n: "02", tag: "RECEIVE", icon: CircleDollarSign, title: "Your MYRAVEN identity", copy: "A personal MYRAVEN ID and verified profile that connect your wallet, funding options and payment activity." },
  { n: "03", tag: "SEND", icon: Globe2, title: "Send across destinations", copy: "Prepare transfers to MYRAVEN users, Solana addresses and supported local bank or mobile-money payout routes." }
];

const intelligence = [
  { icon: Route, title: "SmartRoute", copy: "Compare eligible routes using cost, speed, reliability and recipient preferences." },
  { icon: Sparkles, title: "Pay AI", copy: "Describe a transfer in everyday language. Pay AI prepares the details; you review and approve every payment yourself." },
  { icon: ScanLine, title: "Recipient clarity", copy: "Match MYRAVEN profiles and show destination details before confirmation. External wallet ownership is never assumed." },
  { icon: Activity, title: "Payment visibility", copy: "Follow the stages of a payment with references, events and clear status updates." },
  { icon: RefreshCw, title: "Payment recovery", copy: "A planned recovery experience for failed, delayed or interrupted payment journeys." },
  { icon: Bell, title: "Useful notifications", copy: "Stay informed about account activity, payment progress and actions that need attention." }
];

const capabilities = [
  { icon: Fingerprint, title: "One MYRAVEN identity", copy: "Unique MYRAVEN ID and account identity, with sign-up options designed around email, phone and supported social login." },
  { icon: Landmark, title: "Local payout network", copy: "Country-aware bank and payment-provider selection, with account-name checks where a connected provider supports them." },
  { icon: CreditCard, title: "Flexible funding", copy: "A planned funding layer for cards, bank transfers, mobile money and supported crypto on-ramps." },
  { icon: QrCode, title: "Payment links & QR", copy: "Create shareable payment requests and QR-based ways to receive value." },
  { icon: ReceiptText, title: "Subscriptions & recurring flows", copy: "Tools for repeat payments, billing schedules, receipts and payment history." },
  { icon: RefreshCw, title: "Refunds & reconciliation", copy: "A clearer way to follow reversals, refunds, provider references and business records." },
  { icon: Building2, title: "Business workspaces", copy: "Business profiles, team roles and shared payment operations for growing organisations." },
  { icon: Smartphone, title: "Local access experiences", copy: "A foundation for mobile-first and USSD-style experiences where local partners make them available." },
  { icon: LockKeyhole, title: "Account protection", copy: "Identity checks, permission boundaries, secure recovery and payment confirmation designed into the journey." }
];

const steps = [
  ["01", "Fund", "Choose a funding method that is available in your region."],
  ["02", "Receive & convert", "See how supported funding is quoted and converted into the SOL-denominated account balance."],
  ["03", "Choose a recipient", "Use a MYRAVEN ID, MYRAVEN account number, Solana address or supported local payout destination."],
  ["04", "Review & authorise", "Check the recipient, amount, fees, exchange quote and destination before approving."],
  ["05", "Track", "Follow the payment reference and status through the stages that apply to that route."]
];

export default function Home() {
  return <main className="marketing-site">
    <header className="marketing-nav">
      <Link href="/" className="marketing-brand"><span className="marketing-brand-mark"><i/><b/></span>MYRAVEN</Link>
      <nav><a href="#platform">Platform</a><a href="#journey">How it works</a><a href="#intelligence">Intelligence</a><a href="#capabilities">Features</a><a href="#audience">For business</a></nav>
      <Link href="/demo" className="button-secondary">Try interactive demo <ArrowUpRight size={14}/></Link><AuthActions />
    </header>

    <section className="marketing-hero">
      <div className="hero-copy">
        <div className="marketing-kicker"><i/> GLOBAL PAYMENTS. CONNECTED INTELLIGENCE.</div>
        <h1>Money moves.<br/><em>Intelligence</em><br/>connects.</h1>
        <p>Send your SOL worldwide or pay out to a local bank account. From wallet to bank, across borders and currencies — MYRAVEN has you covered.</p>
        <div className="hero-ctas"><Link className="button-primary" href="/account">Create your account <ArrowUpRight size={16}/></Link><a className="button-secondary" href="#platform">Explore the platform <ArrowDown size={15}/></a></div>
        <div className="hero-note"><i/> Solana-first settlement design <span/> Built for connected payment journeys</div>
      </div>
      <div className="hero-visual">
        <div className="hero-media-card">
          <div className="media-top"><span><i/> MYRAVEN NETWORK</span><small>VALUE IN MOTION</small></div>
          <div className="media-scene"><div className="media-orbit o1"/><div className="media-orbit o2"/><div className="media-orbit o3"/><div className="media-core"><b>M</b><small>CONNECTED VALUE</small></div><span className="media-node n1">SOL</span><span className="media-node n2">ID</span><span className="media-node n3">FX</span><span className="media-node n4">PAY</span><i className="media-streak s1"/><i className="media-streak s2"/></div>
          <div className="media-bottom">ONE CONNECTED PAYMENT EXPERIENCE <span className="sound-bars"><i/><i/><i/><i/><i/></span></div>
        </div>
        <div className="float-card float-a"><b><ArrowLeftRight size={15}/> One connected flow</b><small>Fund · Receive · Send</small></div>
        <div className="float-card float-b"><b><Globe2 size={15}/> Multiple destinations</b><small>Routes depend on provider coverage</small></div>
      </div>
      <a className="scroll-cue" href="#platform">SCROLL TO EXPLORE <ArrowDown size={13}/></a>
    </section>

    <div className="value-strip"><span>THE MYRAVEN APPROACH</span><b>One identity</b><i/><b>Solana-first</b><i/><b>Intelligent routing</b><i/><b>Clear payment status</b></div>

    <section className="marketing-section" id="platform">
      <div className="section-heading"><div><label>THE CORE PLATFORM <span>01 / 05</span></label><h2>One account.<br/>More ways to <em>move.</em></h2></div><p>MYRAVEN brings the key parts of a payment journey together — from funding and receiving to recipient checks, local payout options and payment tracking.</p></div>
      <div className="product-grid">{products.map(p => { const I = p.icon; return <article className="product-card" key={p.n}><div className="product-top"><span>{p.n} / {p.tag}</span><I size={19}/></div><div className="product-art"><div/><b>{p.n === "02" ? "◎" : ""}</b></div><h3>{p.title}</h3><p>{p.copy}</p><Link href="/account">Explore account experience <ArrowUpRight size={14}/></Link></article>; })}</div>
    </section>

    <section className="journey-section" id="journey">
      <div><label>THE PAYMENT JOURNEY <span>02 / 05</span></label><h2>From first tap<br/>to <em>final destination.</em></h2><p>Keep each decision visible. MYRAVEN is designed to show the recipient, quote, fees and payment progress before and after you authorise a transfer.</p><Link className="text-link" href="/account">Explore the account experience <ArrowUpRight size={15}/></Link></div>
      <div className="journey-steps">{steps.map(([n, title, copy], i) => { const Icon = [Wallet, ArrowLeftRight, Fingerprint, ShieldCheck, Activity][i]; return <div className="journey-step" key={n}><span>{n}</span><div><b>{title}</b><p>{copy}</p></div><Icon size={18}/></div>; })}</div>
    </section>

    <section className="intelligence-section" id="intelligence">
      <div className="intelligence-art"><div className="intel-grid"/><div className="intel-orb">MRV</div><span className="intel-chip ca">SMARTROUTE ↗</span><span className="intel-chip cb">PAY AI ✦</span><span className="intel-chip cc">SOLANA ◎</span></div>
      <div><label>INTELLIGENCE IN THE FLOW <span>03 / 05</span></label><h2>Less guesswork.<br/><em>More clarity.</em></h2><p>Useful intelligence belongs close to the payment decision — helping people understand options without taking control away from them.</p><div className="tool-list">{intelligence.map(t => { const I = t.icon; return <div className="tool-row" key={t.title}><span><I size={16}/></span><div><b>{t.title}</b><small>{t.copy}</small></div><ArrowUpRight size={14}/></div>; })}</div></div>
    </section>

    <section className="capabilities-section" id="capabilities">
      <div className="section-heading"><div><label>THE WIDER MYRAVEN ECOSYSTEM <span>04 / 05</span></label><h2>More than a transfer.<br/><em>A connected toolkit.</em></h2></div><p>The roadmap extends beyond sending money: identity, local payment access, business operations, payment requests and the tools that help people manage what happens next.</p></div>
      <div className="capability-grid">{capabilities.map(c => { const I = c.icon; return <article className="capability-card" key={c.title}><span><I size={18}/></span><h3>{c.title}</h3><p>{c.copy}</p></article>; })}</div>
    </section>

    <section className="audience-section marketing-section" id="audience">
      <div className="section-heading"><div><label>WHO IT IS FOR <span>05 / 05</span></label><h2>One platform.<br/><em>Different journeys.</em></h2></div><p>Designed for personal payments and business workflows, with features and access shaped by supported countries, providers and applicable requirements.</p></div>
      <div className="audience-grid">
        <article><label>01 / PERSONAL</label><Globe2 size={22}/><h3>For everyday connections</h3><p>Receive value through your MYRAVEN identity, prepare cross-border payments and keep track of your activity.</p><Link href="/account">Discover personal accounts <ArrowUpRight size={14}/></Link></article>
        <article><label>02 / BUSINESS</label><Building2 size={22}/><h3>For teams and businesses</h3><p>Organise payment activity, team permissions, payment requests, recurring flows and reconciliation as operations grow.</p><Link href="/account">Explore the platform <ArrowUpRight size={14}/></Link></article>
      </div>
    </section>

    <section className="trust-section">
      <div className="trust-copy"><label>BUILT WITH TRANSPARENCY IN MIND</label><h2>Know what happens<br/><em>before you approve.</em></h2><p>Payment clarity is a product principle, not an afterthought. The experience is designed to distinguish estimates from confirmed quotes, pending steps from completed ones, and a profile match from proof of identity.</p></div>
      <div className="trust-points">
        <div><ShieldCheck size={19}/><span><b>Review before approval</b><small>Recipient, destination, amount, fees and quote are presented for review.</small></span></div>
        <div><BadgeCheck size={19}/><span><b>Identity checks where supported</b><small>Verification depends on the connected provider and the requirements for that service.</small></span></div>
        <div><Activity size={19}/><span><b>Traceable payment records</b><small>Designed around unique references, event history and provider or on-chain references where applicable.</small></span></div>
        <div><LockKeyhole size={19}/><span><b>Protection built into the flow</b><small>Authentication, permissions, recovery and explicit payment authorisation matter at every stage.</small></span></div>
      </div>
    </section>

    <section className="journal-section" id="journal"><div className="journal-art"><div/><i/></div><div><label>THE MYRAVEN JOURNAL</label><h2>Ideas for a world<br/>that <em>keeps moving.</em></h2><p>Payment explainers, product notes and perspectives on the future of connected finance.</p><span>JOURNAL COMING SOON</span></div></section>

    <section className="closing-section" id="about"><label>THE NEXT CHAPTER OF CONNECTED PAYMENTS</label><h2>Make every move<br/><em>more connected.</em></h2><p>Explore MYRAVEN, follow the product as it develops and discover the experience we are building.</p><Link className="button-primary" href="/account">Get started with MYRAVEN <ArrowUpRight size={16}/></Link></section>

    <footer className="marketing-footer">
      <div><Link href="/" className="marketing-brand"><span className="marketing-brand-mark"><i/><b/></span>MYRAVEN</Link><p>Money moves. Intelligence connects.</p></div>
      <nav><a href="#platform">Platform</a><a href="#journey">How it works</a><a href="#intelligence">Intelligence</a><a href="#capabilities">Features</a><a href="#audience">For business</a><a href="#journal">Journal</a><Link href="/account">Account</Link><Link href="/account?mode=signin">Log in</Link></nav>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} MYRAVEN</span><span>Solana-first payment orchestration concept</span><span>Availability depends on supported providers, regions and verification.</span></div>
    </footer>
    <div className="platform-disclaimer"><span>PRODUCT STATUS</span> MYRAVEN is being developed. Some experiences shown are planned or illustrative; live funding, conversion, payouts and availability require connected providers, regulatory approvals and testing. SOL is the planned blockchain settlement asset.</div>
  </main>;
}
