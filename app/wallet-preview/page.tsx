"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Copy, LockKeyhole, ShieldCheck, Wallet, Sparkles } from "lucide-react";

export default function WalletPreviewPage() {
  const [created, setCreated] = useState(false);
  const [reference, setReference] = useState("");

  function generatePreview() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const token = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    setReference("DEMO-" + token + "-NOT-A-SOLANA-ADDRESS");
    setCreated(true);
  }

  async function copyReference() {
    if (reference) await navigator.clipboard.writeText(reference);
  }

  return (
    <main className="min-h-screen bg-[#08090e] px-5 py-8 text-[#f2f3f8] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="mb-10 inline-flex items-center gap-2 text-sm text-[#9299aa] hover:text-white">
          <ArrowLeft size={16} /> Back to MYRAVEN
        </Link>
        <div className="mb-7 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-200"><Wallet size={21} /></div>
          <div><p className="text-xs tracking-[.2em] text-violet-300">MYRAVEN · SOLANA</p><h1 className="text-2xl font-semibold tracking-tight">Your wallet</h1></div>
        </div>
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#17172a] via-[#111521] to-[#0d1820] p-6 shadow-2xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs tracking-[.18em] text-white/50">PERSONAL WALLET</p><p className="mt-2 text-sm text-white/70">Solana · SOL</p></div>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] tracking-wider text-amber-200">DEVELOPMENT PREVIEW</span>
          </div>
          <div className="mt-12">
            <p className="text-xs text-white/45">DEMO BALANCE</p>
            <p className="mt-1 text-4xl font-semibold tracking-tight">— <span className="text-lg text-white/50">SOL</span></p>
            <p className="mt-2 text-xs text-white/45">No funds or blockchain account are connected.</p>
          </div>
          <div className="mt-8 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] tracking-[.17em] text-white/45">WALLET IDENTIFIER</p>
            {created ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><code className="break-all text-sm text-cyan-200">{reference}</code><button onClick={copyReference} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/5"><Copy size={13} /> Copy</button></div> : <p className="mt-3 text-sm text-white/40">No preview created yet</p>}
          </div>
          <button onClick={generatePreview} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-300 to-cyan-200 px-5 py-3.5 text-sm font-semibold text-[#10121a] transition hover:brightness-110">
            <Sparkles size={16} /> {created ? "Generate another demo preview" : "Generate wallet preview"}
          </button>
        </section>
        <div className="mt-5 flex gap-3 rounded-xl border border-amber-300/15 bg-amber-300/[.05] p-4 text-sm leading-6 text-amber-100/80">
          <ShieldCheck className="mt-1 shrink-0 text-amber-200" size={17} />
          <p><strong className="font-semibold text-amber-100">This is a visual test only.</strong> The identifier above is deliberately not a Solana address. No cryptographic wallet is created, no private key exists, and it cannot receive or send funds. Real Privy wallet provisioning must be enabled separately in an eligible development setup.</p>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-white/40"><LockKeyhole size={13} /> Your MYRAVEN sign-in remains managed by Supabase.</div>
      </div>
    </main>
  );
}
