"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";

type AccountType = "personal" | "business";
type AccountSummary = {
  profile: { myraven_id: string; display_name: string | null; country_code: string | null; account_type?: AccountType } | null;
  email: string | null;
  balances: { account_id: string; asset_code: string; network_code: string; account_type: string; balance: string }[];
  transactions: { id: string; source_type: string; description: string | null; status: string; created_at: string }[];
  note: string;
};

export default function AccountPage() {
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [checking, setChecking] = useState(true);
  const supabase = createClient();

  const destination = accountType === "business" ? "/business" : "/dashboard";
  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/account/summary", { cache: "no-store" });
    if (!response.ok) { setSummary(null); return; }
    setSummary(await response.json());
  }, []);

  const provisionWorkspace = useCallback(async (type: AccountType) => {
    const response = await fetch("/api/account/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType: type }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not set up your workspace.");
    return data;
  }, [displayName, businessName, countryCode]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedType = params.get("type") === "business" ? "business" : "personal";
    setAccountType(requestedType);
    if (params.get("mode") === "signin") setMode("signin");
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return;
      if (data.user) {
        try {
          const contextResponse = await fetch("/api/account/context", { cache: "no-store" });
          const context = contextResponse.ok ? await contextResponse.json() : null;
          const chosenType: AccountType = context?.accountType ?? requestedType;
          if (params.get("complete") === "1" || !context?.accountType) {
            await provisionWorkspace(requestedType);
            window.location.replace(requestedType === "business" ? "/business" : "/dashboard");
            return;
          }
          window.location.replace(chosenType === "business" ? "/business" : "/dashboard");
          return;
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Workspace setup needs attention.");
        }
      }
      setChecking(false);
    });
    return () => { active = false; };
  }, [supabase, provisionWorkspace]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            data: { display_name: displayName.trim(), account_type: accountType, business_name: businessName.trim(), country_code: countryCode.trim().toUpperCase() },
            emailRedirectTo: window.location.origin + "/auth/callback?next=/account?type=" + accountType + "%26complete=1",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account. Your selected workspace will be prepared after confirmation.");
        } else {
          await provisionWorkspace(accountType);
          window.location.assign(destination);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const response = await fetch("/api/account/context", { cache: "no-store" });
        const context = response.ok ? await response.json() : null;
        const actualType: AccountType = context?.accountType ?? accountType;
        if (actualType !== accountType) {
          setMessage("This login belongs to a " + actualType + " account. Switch account type to continue.");
        } else {
          window.location.assign(actualType === "business" ? "/business" : "/dashboard");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not complete account request.");
    } finally { setLoading(false); }
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setMessage("");
    try {
      if (!otpSent) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: phone.trim(), options: { shouldCreateUser: mode === "signup", data: { display_name: displayName.trim(), account_type: accountType, business_name: businessName.trim(), country_code: countryCode.trim().toUpperCase() } },
        });
        if (error) throw error;
        setOtpSent(true); setMessage("A one-time code was requested. Enter it to continue.");
      } else {
        const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: otp.trim(), type: "sms" });
        if (error) throw error;
        await provisionWorkspace(accountType);
        window.location.assign(destination);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Phone verification is unavailable. Check the SMS provider configuration.");
    } finally { setLoading(false); }
  }

  async function signInWithGoogle() {
    setLoading(true); setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth/callback?next=/account?type=" + accountType + "%26complete=1" },
    });
    if (error) { setMessage(error.message); setLoading(false); }
  }

  if (checking) return <main className="account-shell"><div className="account-card"><LoaderCircle className="spin" /> Preparing your MYRAVEN workspace…</div></main>;

  return <main className="account-shell">
    <div className="account-top"><Link href="/"><ArrowLeft size={16}/> Back to MYRAVEN</Link><span>MYRAVEN ACCOUNT</span></div>
    <section className="account-card account-choice-card">
      <Link className="account-brand" href="/"><span>M</span> MYRAVEN</Link>
      <div className="account-eyebrow"><ShieldCheck size={14}/> CHOOSE YOUR WORKSPACE</div>
      <h1>{mode === "signup" ? "Start with the right account." : "Sign in to your workspace."}</h1>
      <p className="account-subtitle">Personal and business have separate tools, onboarding and workspaces.</p>
      <div className="account-type-choice">
        <button type="button" className={accountType === "personal" ? "selected" : ""} onClick={() => { setAccountType("personal"); setMessage(""); }}><UserRound/><span><b>Personal</b><small>For individual payments and money management</small></span></button>
        <button type="button" className={accountType === "business" ? "selected" : ""} onClick={() => { setAccountType("business"); setMessage(""); }}><Building2/><span><b>Business</b><small>For organisations, teams and payment operations</small></span></button>
      </div>
      <div className="account-mode">
        <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setOtpSent(false); }}>Create account</button>
        <button type="button" className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); setOtpSent(false); }}>Sign in</button>
      </div>
      <div className="account-mode account-method">
        <button type="button" className={authMethod === "email" ? "selected" : ""} onClick={() => { setAuthMethod("email"); setOtpSent(false); }}>Email</button>
        <button type="button" className={authMethod === "phone" ? "selected" : ""} onClick={() => { setAuthMethod("phone"); setOtpSent(false); }}>Phone</button>
      </div>
      {authMethod === "phone" ? <form className="account-form" onSubmit={submitPhone}>
        {mode === "signup" && <><label>YOUR NAME<input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={60}/></label>{accountType === "business" && <label>BUSINESS NAME<input value={businessName} onChange={e => setBusinessName(e.target.value)} required maxLength={120}/></label>}</>}
        <label>PHONE NUMBER<input type="tel" value={phone} onChange={e => setPhone(e.target.value)} required placeholder="+ country code" autoComplete="tel"/></label>
        {otpSent && <label>ONE-TIME CODE<input inputMode="numeric" value={otp} onChange={e => setOtp(e.target.value)} required maxLength={8}/></label>}
        <button className="account-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : null}{otpSent ? "Verify phone" : "Continue with phone"}<ArrowUpRight size={16}/></button>
      </form> : <form className="account-form" onSubmit={submit}>
        {mode === "signup" && <label>{accountType === "business" ? "YOUR NAME" : "DISPLAY NAME"}<input value={displayName} onChange={e => setDisplayName(e.target.value)} required maxLength={60} autoComplete="name"/></label>}
        {mode === "signup" && accountType === "business" && <label>BUSINESS / ORGANISATION NAME<input value={businessName} onChange={e => setBusinessName(e.target.value)} required maxLength={120} placeholder="Registered or trading name"/></label>}
        {mode === "signup" && <label>COUNTRY CODE<input value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} maxLength={2} placeholder="e.g. NG"/></label>}
        <label>EMAIL ADDRESS<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/></label>
        <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"}/></label>
        <button className="account-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : null}{mode === "signup" ? "Create " + (accountType === "business" ? "business" : "personal") + " account" : "Sign in"}<ArrowUpRight size={16}/></button>
      </form>}
      {authMethod === "email" && <><div className="account-or"><span/> OR <span/></div><button className="account-google" onClick={signInWithGoogle} disabled={loading}>Continue with Google <ArrowUpRight size={15}/></button></>}
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-legal">Your workspace type controls product access, not financial eligibility. Regulated services remain subject to age, country, provider and verification requirements. Payment execution is not enabled in this preview.</p>
    </section>
    <footer className="account-footer">MONEY MOVES. INTELLIGENCE CONNECTS.</footer>
  </main>;
}
