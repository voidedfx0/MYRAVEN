"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, Check, LoaderCircle, Save, ShieldCheck } from "lucide-react";

type Draft = {
  businessName: string; legalName: string; countryCode: string; businessType: string;
  registrationNumber: string; industry: string; description: string; website: string;
  address: string; city: string; postalCode: string; operatingCountries: string;
};

const empty: Draft = { businessName: "", legalName: "", countryCode: "", businessType: "limited_company", registrationNumber: "", industry: "", description: "", website: "", address: "", city: "", postalCode: "", operatingCountries: "" };

export default function BusinessOnboardingPage() {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/business/onboarding", { cache: "no-store" }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Could not load business profile.");
      if (!active) return;
      const b = data.business;
      setDraft({
        businessName: b.business_name ?? "", legalName: b.legal_name ?? "", countryCode: b.country_code ?? "",
        businessType: b.business_type ?? "limited_company", registrationNumber: b.registration_number ?? "",
        industry: b.industry ?? "", description: b.business_description ?? "", website: b.website_url ?? "",
        address: b.address_line ?? "", city: b.city ?? "", postalCode: b.postal_code ?? "",
        operatingCountries: Array.isArray(b.operating_countries) ? b.operating_countries.join(", ") : "",
      });
      if (b.onboarding_status === "profile_completed") setDone(true);
    }).catch(e => { if (active) setNotice(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function update(key: keyof Draft, value: string) { setDraft(d => ({ ...d, [key]: value })); }

  async function save(submit: boolean) {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/business/onboarding", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, operatingCountries: draft.operatingCountries.split(",").map(v => v.trim()).filter(Boolean), submit }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not save your profile.");
      if (submit) { setDone(true); setNotice("Business profile completed. Verification has not been performed; sensitive payment features remain unavailable."); }
      else setNotice("Progress saved securely.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not save your profile."); }
    finally { setSaving(false); }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); if (step === 1) setStep(2); else void save(true); }

  if (loading) return <main className="business-onboard-shell"><div className="business-onboard-card"><LoaderCircle className="spin"/> Loading your business profile…</div></main>;

  return <main className="business-onboard-shell">
    <header className="business-onboard-top"><Link href="/business"><ArrowLeft size={16}/> Business workspace</Link><span>MYRAVEN BUSINESS SETUP</span></header>
    <section className="business-onboard-card">
      <Link className="account-brand" href="/"><span>M</span> MYRAVEN</Link>
      <div className="account-eyebrow"><Building2 size={14}/> BUSINESS PROFILE</div>
      <h1>{done ? "Your business profile" : "Let's set up your business."}</h1>
      <p className="account-subtitle">A short profile first. Additional verification will only be requested when a supported service requires it.</p>
      <div className="business-onboard-progress"><span className={step === 1 ? "active" : "complete"}><i>{step > 1 ? <Check size={13}/> : "01"}</i> Business details</span><b/><span className={step === 2 ? "active" : ""}><i>02</i> Operations</span></div>
      {done && <div className="business-onboard-success"><ShieldCheck size={18}/><span><b>Profile completed</b><small>Verification status: not verified. Completing this form does not approve the business or activate payment services.</small></span></div>}
      <form className="account-form business-onboard-form" onSubmit={onSubmit}>
        {step === 1 ? <>
          <label>BUSINESS / TRADING NAME<input value={draft.businessName} onChange={e => update("businessName", e.target.value)} required maxLength={120} /></label>
          <label>LEGAL REGISTERED NAME<input value={draft.legalName} onChange={e => update("legalName", e.target.value)} required maxLength={160}/></label>
          <div className="business-onboard-two"><label>COUNTRY OF REGISTRATION<input value={draft.countryCode} onChange={e => update("countryCode", e.target.value.toUpperCase())} required maxLength={2} placeholder="2-letter code, e.g. NG"/></label><label>BUSINESS TYPE<select value={draft.businessType} onChange={e => update("businessType", e.target.value)}><option value="limited_company">Limited company</option><option value="sole_proprietor">Sole proprietor</option><option value="partnership">Partnership</option><option value="nonprofit">Non-profit</option><option value="other">Other</option></select></label></div>
          <label>BUSINESS REGISTRATION NUMBER <span className="field-optional">OPTIONAL FOR NOW</span><input value={draft.registrationNumber} onChange={e => update("registrationNumber", e.target.value)} maxLength={80} placeholder="CAC or equivalent registry number"/></label>
          <label>INDUSTRY<input value={draft.industry} onChange={e => update("industry", e.target.value)} required maxLength={80} placeholder="e.g. Retail, software, professional services"/></label>
        </> : <>
          <label>WHAT DOES YOUR BUSINESS DO?<textarea value={draft.description} onChange={e => update("description", e.target.value)} maxLength={500} rows={3} placeholder="Briefly describe your products or services."/></label>
          <label>BUSINESS WEBSITE <span className="field-optional">OPTIONAL</span><input type="url" value={draft.website} onChange={e => update("website", e.target.value)} placeholder="https://example.com"/></label>
          <label>BUSINESS ADDRESS <span className="field-optional">OPTIONAL FOR PROFILE</span><input value={draft.address} onChange={e => update("address", e.target.value)} maxLength={180}/></label>
          <div className="business-onboard-two"><label>CITY<input value={draft.city} onChange={e => update("city", e.target.value)} maxLength={100}/></label><label>POSTAL CODE<input value={draft.postalCode} onChange={e => update("postalCode", e.target.value)} maxLength={24}/></label></div>
          <label>COUNTRIES WHERE YOU OPERATE <span className="field-optional">OPTIONAL · COMMA-SEPARATED CODES</span><input value={draft.operatingCountries} onChange={e => update("operatingCountries", e.target.value.toUpperCase())} placeholder="NG, GH, KE"/></label>
        </>}
        <div className="business-onboard-actions">
          {step === 2 && <button type="button" className="account-google" onClick={() => setStep(1)}><ArrowLeft size={15}/> Back</button>}
          <button type="button" className="account-google" onClick={() => void save(false)} disabled={saving}><Save size={15}/> Save progress</button>
          <button className="account-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" size={16}/> : null}{step === 1 ? "Continue" : done ? "Update profile" : "Complete profile"} <ArrowRight size={16}/></button>
        </div>
      </form>
      {notice && <p className="account-message" role="status">{notice}</p>}
      <div className="business-onboard-security"><ShieldCheck size={16}/><span>Only your signed-in business owner account can edit this profile. Do not enter personal identity numbers, passwords or upload identity documents here. Any future verification must use an approved, secure verification process.</span></div>
      <Link className="business-onboard-dashboard" href="/business">Return to business workspace <ArrowUpRight size={14}/></Link>
    </section>
  </main>;
}
