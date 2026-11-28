"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowUpRight, Bell, Building2, Check, ChevronRight, CircleHelp,
  Copy, Download, ExternalLink, Globe2, KeyRound, LockKeyhole, LogOut, MonitorSmartphone,
  RefreshCw, ShieldCheck, SlidersHorizontal, UserRound, Wallet, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AccountKind = "personal" | "business";
type Preferences = { displayName: string; currency: string; paymentAlerts: boolean; securityAlerts: boolean; productUpdates: boolean };
type WalletInfo = { address: string; status: string; network: string } | null;

const defaults: Preferences = { displayName: "", currency: "USD", paymentAlerts: true, securityAlerts: true, productUpdates: false };

const sections = [
  { id: "profile", label: "Profile", icon: UserRound, hint: "Your account details" },
  { id: "identity", label: "Identity & KYC", icon: ShieldCheck, hint: "Verification and legal details" },
  { id: "security", label: "Security", icon: LockKeyhole, hint: "Password and account access" },
  { id: "payments", label: "Payment preferences", icon: SlidersHorizontal, hint: "Currency and payment defaults" },
  { id: "wallets", label: "Wallets & connections", icon: Wallet, hint: "Connected services" },
  { id: "notifications", label: "Notifications", icon: Bell, hint: "Choose what reaches you" },
  { id: "privacy", label: "Privacy & data", icon: Globe2, hint: "Your data and account controls" },
  { id: "help", label: "Help & legal", icon: CircleHelp, hint: "Support and policies" },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState<AccountKind>("personal");
  const [preferences, setPreferences] = useState<Preferences>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("profile");
  const [wallet, setWallet] = useState<WalletInfo>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { data, error: authError } = await supabase.auth.getUser();
      if (!alive) return;
      if (authError || !data.user) { router.replace("/account?mode=signin"); return; }
      const user = data.user;
      const meta = user.user_metadata ?? {};
      const kind: AccountKind = meta.account_type === "business" ? "business" : "personal";
      setEmail(user.email ?? "");
      setAccountType(kind);
      setPreferences({
        displayName: String(meta.display_name ?? [meta.first_name, meta.last_name].filter(Boolean).join(" ") ?? ""),
        currency: String(meta.preferred_currency ?? "USD"),
        paymentAlerts: meta.payment_alerts !== false,
        securityAlerts: meta.security_alerts !== false,
        productUpdates: meta.product_updates === true,
      });
      setLoading(false);
      try {
        const walletResponse = await fetch("/api/account/wallet", { method: "POST", cache: "no-store" });
        const walletData = await walletResponse.json();
        if (!walletResponse.ok) throw new Error(walletData.error ?? "Wallet provisioning is unavailable.");
        if (alive) setWallet({ address: walletData.address, status: walletData.status, network: walletData.network });
      } catch (walletIssue) {
        if (alive) setWalletError(walletIssue instanceof Error ? walletIssue.message : "Could not load your wallet.");
      } finally { if (alive) setWalletLoading(false); }
    }
    void load();
    return () => { alive = false; };
  }, [router, supabase]);

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ data: {
      display_name: preferences.displayName.trim(),
      preferred_currency: preferences.currency,
      payment_alerts: preferences.paymentAlerts,
      security_alerts: preferences.securityAlerts,
      product_updates: preferences.productUpdates,
    }});
    if (updateError) setError(updateError.message);
    else setMessage("Your preferences have been saved.");
    setSaving(false);
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    if (password.length < 10) { setError("Use at least 10 characters for your new password."); setSaving(false); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); setSaving(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) setError(updateError.message);
    else { setMessage("Password updated. Use the new password next time you sign in."); setPassword(""); setConfirmPassword(""); }
    setSaving(false);
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("newEmail") ?? "").trim();
    if (!nextEmail || nextEmail.toLowerCase() === email.toLowerCase()) { setError("Enter a different email address."); setSaving(false); return; }
    const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
    if (updateError) setError(updateError.message);
    else setMessage("Check your inbox to confirm the new email address. Your current email remains active until confirmation.");
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/account?mode=signin");
  }

  if (loading) return <main className="settings-shell"><div className="settings-loading">Loading your secure settings…</div></main>;

  return <main className="settings-shell">
    <header className="settings-topbar">
      <Link href="/dashboard" className="settings-back"><ArrowLeft size={16}/> Back to workspace</Link>
      <Link href="/" className="settings-wordmark">MYRAVEN <span>SETTINGS</span></Link>
      <button className="settings-signout" onClick={() => void signOut()}><LogOut size={15}/> Sign out</button>
    </header>
    <div className="settings-layout">
      <aside className="settings-sidebar">
        <div className="settings-overline">ACCOUNT CONTROL</div>
        <h1>Settings</h1>
        <p>Manage your identity, security and payment experience.</p>
        <div className="settings-account-chip"><span className="settings-avatar">{preferences.displayName.slice(0,1).toUpperCase() || "M"}</span><span><b>{preferences.displayName || "MYRAVEN user"}</b><small>{accountType === "business" ? "Business workspace" : "Personal workspace"}</small></span></div>
        <nav className="settings-nav" aria-label="Settings sections">
          {sections.map(({id,label,icon:Icon,hint}) => <a key={id} href={"#"+id} className={activeSection===id?"selected":""} onClick={() => setActiveSection(id)}><Icon size={16}/><span><b>{label}</b><small>{hint}</small></span><ChevronRight size={14}/></a>)}
        </nav>
      </aside>

      <section className="settings-content">
        <div className="settings-heading"><div><div className="settings-overline">MYRAVEN / ACCOUNT</div><h2>Account controls</h2><p>Changes to your settings apply to this {accountType} account.</p></div><span className="settings-mode"><i/> PREVIEW</span></div>
        {(message || error) && <div className={error ? "settings-feedback error" : "settings-feedback"} role="status">{error || message}<button onClick={() => {setMessage("");setError("");}} aria-label="Dismiss"><X size={14}/></button></div>}

        <section className="settings-card" id="profile">
          <div className="settings-card-title"><span className="settings-icon"><UserRound size={18}/></span><div><h3>Personal profile</h3><p>Keep your contact and display information current.</p></div></div>
          <form onSubmit={savePreferences} className="settings-form">
            <label>DISPLAY NAME<input value={preferences.displayName} onChange={e=>setPreferences(p=>({...p,displayName:e.target.value}))} maxLength={80} placeholder="How your name appears in MYRAVEN"/></label>
            <label>EMAIL ADDRESS<input value={email} disabled/><small>Use the email-change section below to update this address.</small></label>
            <div className="settings-note"><LockKeyhole size={15}/> Your legal identity details are handled separately from your display name.</div>
            <button className="settings-primary" type="submit" disabled={saving}>{saving?"Saving…":"Save profile"} <Check size={15}/></button>
          </form>
          <form onSubmit={changeEmail} className="settings-inline-form"><label>CHANGE EMAIL<input name="newEmail" type="email" required placeholder="New email address"/></label><button className="settings-secondary" disabled={saving}>Request email change <ArrowUpRight size={14}/></button></form>
        </section>

        <section className="settings-card" id="identity">
          <div className="settings-card-title"><span className="settings-icon violet"><ShieldCheck size={18}/></span><div><h3>Identity & KYC</h3><p>Verification status and protected identity information.</p></div><span className="settings-status pending">NOT CONNECTED</span></div>
          <div className="kyc-status-panel"><div className="kyc-status-mark"><ShieldCheck size={21}/></div><div><b>KYC provider not connected</b><p>Identity verification is not active in this build. No identity document has been verified through MYRAVEN yet.</p></div></div>
          <div className="settings-rule-list">
            <div><span>Legal name</span><b>Protected identity field</b><small>Will become read-only after successful verification.</small></div>
            <div><span>Date of birth</span><b>Protected identity field</b><small>Changes after verification require a reviewed correction request.</small></div>
            <div><span>Country of residence</span><b>Compliance-controlled</b><small>A country change may require a fresh eligibility and verification review.</small></div>
          </div>
          <p className="settings-footnote">MYRAVEN will lock verified legal details after KYC approval. If a genuine error needs correction, the user must contact support and complete any required re-verification. Verification status must be confirmed by the KYC provider on the server, never by a browser setting.</p>
        </section>

        <section className="settings-card" id="security">
          <div className="settings-card-title"><span className="settings-icon"><KeyRound size={18}/></span><div><h3>Security & sign-in</h3><p>Protect access to your account.</p></div></div>
          <form className="settings-form" onSubmit={updatePassword}>
            <label>NEW PASSWORD<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={10} autoComplete="new-password" placeholder="At least 10 characters"/></label>
            <label>CONFIRM NEW PASSWORD<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} minLength={10} autoComplete="new-password" placeholder="Enter it again"/></label>
            <button className="settings-primary" disabled={saving}>Update password <LockKeyhole size={14}/></button>
          </form>
          <div className="settings-feature-row"><MonitorSmartphone size={17}/><span><b>Active sessions & trusted devices</b><small>Session management and device history need a dedicated server-side session service.</small></span><span className="settings-status pending">PLANNED</span></div>
          <div className="settings-feature-row"><ShieldCheck size={17}/><span><b>Two-factor authentication / passkeys</b><small>Enable after the authentication methods are configured and tested.</small></span><span className="settings-status pending">PLANNED</span></div>
        </section>

        <section className="settings-card" id="payments">
          <div className="settings-card-title"><span className="settings-icon cyan"><SlidersHorizontal size={18}/></span><div><h3>Payment preferences</h3><p>Set how MYRAVEN presents payment information.</p></div></div>
          <form className="settings-form" onSubmit={savePreferences}>
            <label>DEFAULT DISPLAY CURRENCY<select value={preferences.currency} onChange={e=>setPreferences(p=>({...p,currency:e.target.value}))}>{["USD","EUR","GBP","CHF","NGN","KES","GHS","ZAR","CAD","AUD","INR","AED"].map(c=><option key={c}>{c}</option>)}</select><small>This controls display preferences only. It does not change SOL settlement or guarantee a live exchange rate.</small></label>
            <button className="settings-primary" disabled={saving}>Save payment preferences <Check size={15}/></button>
          </form>
          <div className="settings-feature-row"><Wallet size={17}/><span><b>Default funding and payout methods</b><small>Choose from providers that are actually enabled for your country.</small></span><span className="settings-status pending">PROVIDER-DEPENDENT</span></div>
        </section>

        <section className="settings-card" id="wallets">
          <div className="settings-card-title"><span className="settings-icon violet"><Wallet size={18}/></span><div><h3>Wallets & connected services</h3><p>Manage external connections and permissions.</p></div></div>
          <div className="settings-feature-row"><Wallet size={17}/><span><b>MYRAVEN embedded Solana wallet</b><small>One personal wallet is provisioned automatically and linked to your MYRAVEN account. No separate wallet connection is required.</small></span><span className={wallet?.address ? "settings-status active" : "settings-status pending"}>{wallet?.address ? "CREATED · DEVNET" : walletLoading ? "SETTING UP" : "NEEDS ATTENTION"}</span></div>
          <div className="settings-wallet-panel">
            {walletLoading ? <div className="settings-note"><RefreshCw size={15}/> Checking your MYRAVEN wallet…</div> : wallet?.address ? <>
              <div className="settings-wallet-details">
                <img className="settings-wallet-qr" src={"https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data="+encodeURIComponent(wallet.address)} alt="QR code for your Solana wallet address"/>
                <div className="settings-wallet-address"><span>YOUR SOLANA RECEIVE ADDRESS</span><code>{wallet.address}</code><small>Solana Devnet · Privy embedded wallet</small><div className="settings-wallet-actions"><button type="button" className="settings-secondary" onClick={async()=>{await navigator.clipboard.writeText(wallet.address);setCopied(true);}}><Copy size={14}/>{copied?"Copied":"Copy address"}</button><a className="settings-secondary" href={"https://explorer.solana.com/address/"+wallet.address+"?cluster=devnet"} target="_blank" rel="noreferrer">View on Explorer <ExternalLink size={14}/></a></div></div>
              </div>
              <p className="settings-footnote">This is your unique MYRAVEN wallet address. Only send Devnet SOL to it while MYRAVEN is in test mode. Mainnet deposits are not enabled.</p>
            </> : <div className="settings-wallet-error" role="status">{walletError || "Your wallet has not been provisioned yet."}<button type="button" className="settings-secondary" onClick={async()=>{setWalletLoading(true);setWalletError("");try{const r=await fetch("/api/account/wallet",{method:"POST",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error??"Wallet setup failed.");setWallet({address:d.address,status:d.status,network:d.network});}catch(e){setWalletError(e instanceof Error?e.message:"Wallet setup failed.");}finally{setWalletLoading(false);}}}><RefreshCw size={14}/> Generate wallet</button></div>}
          </div>
          <div className="settings-feature-row"><Building2 size={17}/><span><b>Connected financial providers</b><small>Cards, banks and payout providers will appear here after secure integration.</small></span><span className="settings-status pending">NOT CONNECTED</span></div>
        </section>

        <section className="settings-card" id="notifications">
          <div className="settings-card-title"><span className="settings-icon cyan"><Bell size={18}/></span><div><h3>Notifications</h3><p>Choose which updates you want to receive.</p></div></div>
          <form className="settings-toggle-list" onSubmit={savePreferences}>
            <label><span><b>Payment and transaction updates</b><small>Receipts, status changes and payout updates.</small></span><input type="checkbox" checked={preferences.paymentAlerts} onChange={e=>setPreferences(p=>({...p,paymentAlerts:e.target.checked}))}/></label>
            <label><span><b>Security alerts</b><small>Sign-in, password and account security notices.</small></span><input type="checkbox" checked={preferences.securityAlerts} onChange={e=>setPreferences(p=>({...p,securityAlerts:e.target.checked}))}/></label>
            <label><span><b>Product news and updates</b><small>New features and occasional product announcements.</small></span><input type="checkbox" checked={preferences.productUpdates} onChange={e=>setPreferences(p=>({...p,productUpdates:e.target.checked}))}/></label>
            <button className="settings-primary" disabled={saving}>Save notification preferences <Check size={15}/></button>
          </form>
        </section>

        <section className="settings-card" id="privacy">
          <div className="settings-card-title"><span className="settings-icon"><Globe2 size={18}/></span><div><h3>Privacy & data</h3><p>Understand and control your information.</p></div></div>
          <div className="settings-feature-row"><Download size={17}/><span><b>Download your account data</b><small>Self-service export is not connected yet. You can request a copy through support.</small></span><span className="settings-status pending">PLANNED</span></div>
          <div className="settings-feature-row"><LockKeyhole size={17}/><span><b>Privacy and data permissions</b><small>Provider access and consent history will be listed here.</small></span><span className="settings-status pending">PLANNED</span></div>
          <div className="settings-danger-row"><span><b>Close MYRAVEN account</b><small>Account closure must first check balances, pending payments, disputes and legal retention duties.</small></span><button type="button" disabled>Contact support</button></div>
        </section>

        {accountType === "business" && <section className="settings-card"><div className="settings-card-title"><span className="settings-icon violet"><Building2 size={18}/></span><div><h3>Business workspace</h3><p>Business profile, team access and permissions.</p></div></div><Link className="settings-link-row" href="/business"><span><b>Open business profile and onboarding</b><small>Manage your organisation&apos;s submitted business details.</small></span><ArrowUpRight size={16}/></Link><div className="settings-feature-row"><UserRound size={17}/><span><b>Team members and role permissions</b><small>Invite owners, administrators, finance and read-only team members when team access is enabled.</small></span><span className="settings-status pending">PLANNED</span></div></section>}

        <section className="settings-card" id="help">
          <div className="settings-card-title"><span className="settings-icon"><CircleHelp size={18}/></span><div><h3>Help & legal</h3><p>Get assistance and review MYRAVEN policies.</p></div></div>
          <div className="settings-link-row"><span><b>Help centre and account support</b><small>Support channels will be published before live payments launch.</small></span><span className="settings-status pending">COMING SOON</span></div>
          <div className="settings-link-row"><span><b>Terms of service · Privacy policy · Fees</b><small>Final legal documents must be published before production financial services.</small></span><span className="settings-status pending">COMING SOON</span></div>
        </section>
        <footer className="settings-footer">MYRAVEN · MONEY MOVES. INTELLIGENCE CONNECTS. <span>Account settings are not a substitute for provider verification or regulatory approval.</span></footer>
      </section>
    </div>
  </main>;
}
