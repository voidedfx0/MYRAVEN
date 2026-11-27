import {
  ArrowUpRight,
  ArrowRightLeft,
  Globe2,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

const capabilities = [
  {
    icon: ArrowRightLeft,
    title: "Payments that connect",
    description:
      "A unified experience for local and cross-border payments across supported methods and currencies.",
  },
  {
    icon: Globe2,
    title: "One identity, more ways to receive",
    description:
      "A MYRAVEN ID connects people to their verified receiving preferences without exposing private account details.",
  },
  {
    icon: ShieldCheck,
    title: "Clarity at every step",
    description:
      "Understand fees, exchange rates, payment progress and recovery options before and after you approve.",
  },
  {
    icon: Sparkles,
    title: "Intelligence throughout",
    description:
      "Helpful financial intelligence designed to explain, compare and prepare actions while keeping people in control.",
  },
];

export default function Home() {
  return (
    <main className="site-shell">
      <nav className="topbar">
        <a className="brand" href="/" aria-label="MYRAVEN home">
          <span className="brand-mark">M</span>
          <span>MYRAVEN</span>
        </a>
        <div className="nav-links">
          <a href="#platform">Platform</a>
          <a href="#principles">Why MYRAVEN</a>
          <a className="nav-cta" href="mailto:hello@myraven.com">
            Get in touch <ArrowUpRight size={15} />
          </a>
        </div>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="status-dot" /> A more connected financial experience</div>
        <h1>Money moves.<br /><span>Intelligence connects.</span></h1>
        <p className="hero-copy">
          One intelligent platform connecting people, businesses and payment
          methods — making it easier to move, receive and understand money.
        </p>
        <div className="hero-actions">
          <a className="primary-button" href="#platform">
            Explore the platform <ArrowUpRight size={17} />
          </a>
          <a className="text-button" href="#principles">Our principles <span>→</span></a>
        </div>
        <div className="hero-footnote">
          <span className="orbit" aria-hidden="true"><i /><i /><i /></span>
          <span>Designed for a world with many ways to move money.</span>
        </div>
      </section>

      <section className="platform-section" id="platform">
        <div className="section-heading">
          <div>
            <div className="section-kicker">THE PLATFORM</div>
            <h2>Financial complexity,<br />made simpler.</h2>
          </div>
          <p>
            MYRAVEN coordinates the moving parts behind a payment, while
            keeping the important decisions and details in the user’s hands.
          </p>
        </div>
        <div className="capability-grid">
          {capabilities.map(({ icon: Icon, title, description }, index) => (
            <article className="capability-card" key={title}>
              <div className="card-topline">
                <span className="card-icon"><Icon size={19} /></span>
                <span className="card-index">0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="principles-section" id="principles">
        <div className="principles-orb" aria-hidden="true" />
        <div className="section-kicker">A CLEARER WAY FORWARD</div>
        <h2>People choose how they pay.<br />People choose how they receive.</h2>
        <p>MYRAVEN connects the two — through supported routes, clear choices and thoughtful intelligence.</p>
      </section>

      <footer className="footer">
        <a className="brand footer-brand" href="/">
          <span className="brand-mark">M</span><span>MYRAVEN</span>
        </a>
        <span>Money moves. Intelligence connects.</span>
        <span>© {new Date().getFullYear()} MYRAVEN</span>
      </footer>
    </main>
  );
}
