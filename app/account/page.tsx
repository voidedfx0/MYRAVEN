"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ArrowUpRight, LoaderCircle, ShieldCheck } from "lucide-react";

type AccountSummary = {
  profile: { myraven_id: string; display_name: string | null; country_code: string | null } | null;
  email: string | null;
  balances: { account_id: string; asset_code: string; network_code: string; account_type: string; balance: string }[];
  transactions: { id: string; source_type: string; description: string | null; status: string; created_at: string }[];
  note: string;
};

export default function AccountPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [checking, setChecking] = useState(true);

  const supabase = createClient();

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/account/summary", { cache: "no-store" });
    if (!response.ok) {
      setSummary(null);
      return;
    }
    setSummary(await response.json());
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) await loadSummary();
      setChecking(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadSummary();
      } else {
        setSummary(null);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadSummary, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin + "/auth/callback?next=/account",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account. Your MYRAVEN ID is created when the account is provisioned.");
        } else {
          setMessage("Account created. Loading your MYRAVEN profile…");
          await loadSummary();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setMessage("Signed in. Loading your MYRAVEN account…");
        await loadSummary();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete account request.");
    } finally {
      setLoading(false);
    }
  }


  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
        if (error) throw error;
        setOtpSent(true);
        setMessage("A one-time code was requested. Enter it here to finish signing in.");
      } else {
        const { error } = await supabase.auth.verifyOtp({
          phone: phone.trim(),
          token: otp.trim(),
          type: "sms",
        });
        if (error) throw error;
        setMessage("Phone verified. Loading your MYRAVEN account…");
        await loadSummary();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Phone verification is unavailable. Check that an SMS provider is configured.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback?next=/account" },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);
    setMessage(error ? error.message : "Signed out.");
    setSummary(null);
  }

  if (checking) {
    return <main className="account-shell"><div className="account-card"><LoaderCircle className="spin" /> Checking your session…</div></main>;
  }

  return (
    <main className="account-shell">
      <div className="account-top"><a href="/"><ArrowLeft size={16} /> Back to MYRAVEN</a><span>MYRAVEN ACCOUNT</span></div>
      <section className="account-card">
        <a className="account-brand" href="/"><span>M</span> MYRAVEN</a>
        {summary ? (
          <>
            <div className="account-eyebrow"><ShieldCheck size={14} /> PERSONAL WORKSPACE</div>
            <h1>Welcome{summary.profile?.display_name ? ", " + summary.profile.display_name : ""}.</h1>
            <p className="account-subtitle">Your MYRAVEN identity and account activity.</p>
            {summary.email && <p className="account-email">{summary.email}</p>}
            <div className="myraven-id"><span>YOUR MYRAVEN ID</span><strong>{summary.profile?.myraven_id ?? "Provisioning…"}</strong></div>
            <div className="account-section-title">ACCOUNT BALANCES</div>
            {summary.balances.length ? summary.balances.map((balance) => (
              <div className="account-list-row" key={balance.account_id}>
                <span><b>{balance.asset_code}</b><small>{balance.network_code} · {balance.account_type}</small></span>
                <strong>{balance.balance} {balance.asset_code}</strong>
              </div>
            )) : <div className="account-empty">No posted ledger balance yet. MYRAVEN does not create sample funds.</div>}
            <div className="account-section-title">RECENT ACTIVITY</div>
            {summary.transactions.length ? summary.transactions.map((transaction) => (
              <div className="account-list-row" key={transaction.id}>
                <span><b>{transaction.description ?? transaction.source_type}</b><small>{new Date(transaction.created_at).toLocaleString()}</small></span>
                <strong>{transaction.status}</strong>
              </div>
            )) : <div className="account-empty">No account transactions yet.</div>}
            <p className="account-note">{summary.note}</p>
            <button className="account-primary" onClick={signOut} disabled={loading}>Sign out</button>
          </>
        ) : (
          <>
            <div className="account-eyebrow"><ShieldCheck size={14} /> YOUR FINANCIAL WORKSPACE</div>
            <h1>{mode === "signup" ? "Create your account." : "Welcome back."}</h1>
            <p className="account-subtitle">Explore MYRAVEN and keep your preferences and activity together.</p>
            <div className="account-mode">
              <button className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setAuthMethod("email"); setOtpSent(false); }}>Create account</button>
              <button className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setOtpSent(false); }}>Sign in</button>
            </div>
            {mode === "signin" && <div className="account-mode account-method">
              <button className={authMethod === "email" ? "selected" : ""} onClick={() => { setAuthMethod("email"); setOtpSent(false); }}>Email</button>
              <button className={authMethod === "phone" ? "selected" : ""} onClick={() => { setAuthMethod("phone"); setOtpSent(false); }}>Phone</button>
            </div>}
            {mode === "signin" && authMethod === "phone" ? <form className="account-form" onSubmit={submitPhone}>
              <label>PHONE NUMBER<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="+ country code" autoComplete="tel" /></label>
              {otpSent && <label>ONE-TIME CODE<input inputMode="numeric" value={otp} onChange={(event) => setOtp(event.target.value)} required maxLength={8} autoComplete="one-time-code" /></label>}
              <button className="account-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null}{otpSent ? "Verify phone" : "Send verification code"}<ArrowUpRight size={16} /></button>
              <p className="account-legal">Phone sign-in requires an SMS provider to be configured in Supabase.</p>
            </form> : <form className="account-form" onSubmit={submit}>
              {mode === "signup" && <label>DISPLAY NAME<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={60} autoComplete="name" /></label>}
              <label>EMAIL ADDRESS<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
              <label>PASSWORD<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>
              <button className="account-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16} /> : null}{mode === "signup" ? "Create MYRAVEN account" : "Sign in"}<ArrowUpRight size={16} /></button>
            </form>}
            {mode === "signin" && authMethod === "email" && <><div className="account-or"><span /> OR <span /></div>
            <button className="account-google" onClick={signInWithGoogle} disabled={loading}>Continue with Google <ArrowUpRight size={15} /></button></>}
            {message && <p className="account-message" role="status">{message}</p>}
            <p className="account-legal">Early-access account only. Payment, conversion and withdrawal functions remain disabled in this preview. Any future financial services will require applicable eligibility, provider and compliance checks.</p>
          </>
        )}
      </section>
      <footer className="account-footer">MONEY MOVES. INTELLIGENCE CONNECTS.</footer>
    </main>
  );
}
