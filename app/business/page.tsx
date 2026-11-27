"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Activity, ArrowLeftRight, ArrowUpRight, Building2, ClipboardList, FileText, LoaderCircle, LogOut, QrCode, RefreshCw, ShieldCheck, Users, Wallet } from "lucide-react";

type Context = { accountType: "personal" | "business"; profile: { display_name: string | null; myraven_id: string } | null; business: { id: string; business_name: string; verification_status: string; country_code: string | null; onboarding_status?: string } | null };

export default function BusinessWorkspace() {
  const [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    fetch("/api/account/context", { cache: "no-store" }).then(async response => {
      if (!response.ok) { window.location.replace("/account?type=business&mode=signin"); return null; }
      return response.json();
    }).then(data => {
      if (!active || !data) return;
      if (data.accountType !== "business") { window.location.replace("/dashboard"); return; }
      if (data.business?.onboarding_status !== "profile_completed") { window.location.replace("/business/onboarding"); return; }
      setContext(data); setLoading(false);
    }).catch(() => { if (active) { setMessage("Could not load your business workspace."); setLoading(false); } });
    return () => { active = false; };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.assign("/account?type=business&mode=signin");
  }

  if (loading) return <main className="business-shell"><div className="business-loading"><LoaderCircle className="spin"/> Loading business workspace…</div></main>;

  const business = context?.business;
  return <main className="business-shell">
    <aside className="business-sidebar">
      <Link href="/" className="business-logo"><span>◉</span> MYRAVEN</Link>
      <div className="business-workspace"><span><Building2 size={18}/></span><div><small>BUSINESS WORKSPACE</small><b>{business?.business_name ?? "Your business"}</b></div></div>
      <nav><a className="active" href="#overview"><Activity/> Overview</a><a href="#payments"><ArrowLeftRight/> Payments</a><a href="#customers"><Users/> Customers & team</a><a href="#links"><QrCode/> Payment links & QR</a><a href="#reports"><FileText/> Reports</a><a href="#settings"><ClipboardList/> Settings</a></nav>
      <div className="business-sidebar-bottom"><Link href="/account"><ShieldCheck/> Account & security</Link><button onClick={signOut}><LogOut/> Sign out</button></div>
    </aside>
    <section className="business-main" id="overview">
      <header className="business-header"><div><small>MYRAVEN / BUSINESS</small><h1>Business overview</h1></div><Link href="/account">Account <ArrowUpRight size={15}/></Link></header>
      <div className="business-welcome"><div><span>BUSINESS WORKSPACE</span><h2>Welcome{context?.profile?.display_name ? ", " + context.profile.display_name : ""}.</h2><p>Your business operations, payment tools and team controls in one place.</p></div><div className="business-status"><ShieldCheck/><span><b>{business?.verification_status ?? "Unverified"}</b><small>Business profile status</small></span></div></div>
      {message && <p className="business-message">{message}</p>}
      <div className="business-preview-note"><b>PREVIEW WORKSPACE</b> Business payment execution is not enabled. Provider integrations, verification and eligibility checks must be completed before live services are available.</div>
      <div className="business-metrics"><article><span>PAYMENTS PROCESSED</span><strong>—</strong><small>Live provider connection required</small></article><article><span>PAYMENT VOLUME</span><strong>—</strong><small>No sample revenue is shown</small></article><article><span>ACTIVE PAYMENT LINKS</span><strong>—</strong><small>Payment link service not connected</small></article><article><span>TEAM MEMBERS</span><strong>01</strong><small>Workspace owner</small></article></div>
      <section className="business-section" id="payments"><div><small>PAYMENT OPERATIONS</small><h2>Run your payment workflow.</h2><p>Business tools are separated from personal transfers and will be enabled as their provider services are integrated.</p></div><div className="business-tools"><article><Wallet/><b>Business collections</b><p>Receive and reconcile incoming business payments.</p><span>PLANNED</span></article><article><QrCode/><b>Payment links & QR</b><p>Request payment with a shareable link or QR experience.</p><span>PLANNED</span></article><article><RefreshCw/><b>Recurring billing</b><p>Manage repeat payment schedules and subscriptions.</p><span>PLANNED</span></article><article><FileText/><b>Refunds & reports</b><p>Review transaction records, refunds and reconciliation.</p><span>PLANNED</span></article><article id="customers"><Users/><b>Team & permissions</b><p>Prepare role-based access for owners, admins and finance teams.</p><span>OWNER ACCESS READY</span></article><article id="links"><ShieldCheck/><b>Business verification</b><p>Verification status: {business?.verification_status ?? "unverified"}. No regulated service is activated by creating this profile.</p><span>REVIEW REQUIRED</span></article></div></section>
      <footer className="business-footer">MYRAVEN · MONEY MOVES. INTELLIGENCE CONNECTS.</footer>
    </section>
  </main>;
}
