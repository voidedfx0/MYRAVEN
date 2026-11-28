"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Building2, LoaderCircle, ShieldCheck, UserRound } from "lucide-react";

type AccountType = "personal" | "business";
const countries = [
  ["US","United States"],["GB","United Kingdom"],["NG","Nigeria"],["GH","Ghana"],["KE","Kenya"],["ZA","South Africa"],["UG","Uganda"],["TZ","Tanzania"],["RW","Rwanda"],["ET","Ethiopia"],["EG","Egypt"],["MA","Morocco"],["CI","Côte d’Ivoire"],["SN","Senegal"],["CM","Cameroon"],["IN","India"],["PK","Pakistan"],["BD","Bangladesh"],["PH","Philippines"],["ID","Indonesia"],["MY","Malaysia"],["SG","Singapore"],["AE","United Arab Emirates"],["SA","Saudi Arabia"],["TR","Türkiye"],["CH","Switzerland"],["DE","Germany"],["FR","France"],["IT","Italy"],["ES","Spain"],["NL","Netherlands"],["BE","Belgium"],["SE","Sweden"],["NO","Norway"],["DK","Denmark"],["FI","Finland"],["IE","Ireland"],["PT","Portugal"],["PL","Poland"],["UA","Ukraine"],["CA","Canada"],["MX","Mexico"],["BR","Brazil"],["AR","Argentina"],["CL","Chile"],["AU","Australia"],["NZ","New Zealand"],["JP","Japan"],["KR","South Korea"],["CN","China"],["TH","Thailand"],["VN","Vietnam"]
] as const;
export default function AccountPage() {
  const [accountType, setAccountType] = useState<AccountType>("personal");
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [legalFullName, setLegalFullName] = useState("");
  const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const countryName = countries.find(([code]) => code === countryCode)?.[1] ?? "";
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(true);
  const supabase = createClient();

  const destination = accountType === "business" ? "/business" : "/dashboard";
  const provisionWorkspace = useCallback(async (type: AccountType) => {
    const response = await fetch("/api/account/setup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountType: type, firstName, lastName, legalFullName, countryCode, countryName }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not set up your workspace.");
    return data;
  }, [firstName, lastName, legalFullName, countryCode, countryName]);

  const provisionWallet = useCallback(async () => {
    const response = await fetch("/api/account/wallet", { method: "POST" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Your Solana wallet could not be created.");
    return data;
  }, []);

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
            await provisionWallet();
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
  }, [supabase, provisionWorkspace, provisionWallet]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: {
            data: { first_name: firstName.trim(), last_name: lastName.trim(), display_name: displayName, legal_full_name: legalFullName.trim(), account_type: accountType, business_name: businessName.trim(), country_code: countryCode, country_name: countryName },
            emailRedirectTo: window.location.origin + "/auth/callback?next=/account?type=" + accountType + "%26complete=1",
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMessage("Check your email to confirm your account. Your selected workspace will be prepared after confirmation.");
        } else {
          await provisionWorkspace(accountType);
          await provisionWallet();
          window.location.assign(destination);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        const response = await fetch("/api/account/context", { cache: "no-store" });
        const context = response.ok ? await response.json() : null;
        await provisionWallet();
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
        <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); }}>Create account</button>
        <button type="button" className={mode === "signin" ? "selected" : ""} onClick={() => { setMode("signin"); }}>Sign in</button>
      </div>
      <form className="account-form" onSubmit={submit}>
        {mode === "signup" && <>
          <div className="business-onboard-two">
            <label>FIRST NAME<input value={firstName} onChange={e => setFirstName(e.target.value)} required maxLength={60} autoComplete="given-name"/></label>
            <label>LAST NAME<input value={lastName} onChange={e => setLastName(e.target.value)} required maxLength={60} autoComplete="family-name"/></label>
          </div>
          <label>FULL LEGAL NAME <span className="field-optional">MUST MATCH FUTURE KYC DOCUMENTS</span><input value={legalFullName} onChange={e => setLegalFullName(e.target.value)} required maxLength={160} autoComplete="name" placeholder="Enter your full name as shown on your identity document"/></label>
          <label>COUNTRY / REGION<select value={countryCode} onChange={e => setCountryCode(e.target.value)} required><option value="">Select your country</option>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>
          <p className="account-legal">A personal Solana Devnet wallet is created automatically for your MYRAVEN account after sign-up.</p>
        </>}
        {mode === "signup" && accountType === "business" && <label>BUSINESS / ORGANISATION NAME<input value={businessName} onChange={e => setBusinessName(e.target.value)} required maxLength={120} placeholder="Registered or trading name"/></label>}
        
        <label>EMAIL ADDRESS<input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"/></label>
        <label>PASSWORD<input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"}/></label>
        <button className="account-primary" type="submit" disabled={loading}>{loading ? <LoaderCircle className="spin" size={16}/> : null}{mode === "signup" ? "Create " + (accountType === "business" ? "business" : "personal") + " account" : "Sign in"}<ArrowUpRight size={16}/></button>
      </form>
      {message && <p className="account-message" role="status">{message}</p>}
      <p className="account-legal">Your legal name should match your future KYC document exactly. Your Solana wallet is provisioned automatically through Privy and linked to your MYRAVEN account. Regulated services remain subject to applicable eligibility and verification requirements.</p>
    </section>
    <footer className="account-footer">MONEY MOVES. INTELLIGENCE CONNECTS.</footer>
  </main>;
}
