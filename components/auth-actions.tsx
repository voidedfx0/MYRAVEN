"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, LogOut, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = { variant?: "marketing" | "workspace" };

export default function AuthActions({ variant = "marketing" }: Props) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) {
        setSignedIn(Boolean(data.user));
        setReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setSignedIn(Boolean(session?.user));
        setReady(true);
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function logout() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setBusy(false);
      return;
    }
    window.location.assign("/");
  }

  if (!ready) return <div className={variant === "workspace" ? "workspace-auth-actions" : "marketing-actions"} aria-label="Account" />;

  if (variant === "workspace") {
    return (
      <div className="workspace-auth-actions">
        {signedIn ? <Link className="workspace-account-link" href="/settings"><UserRound size={14}/> Account settings <ArrowUpRight size={13}/></Link> : <Link className="workspace-account-link" href="/account?mode=signin">Sign in <ArrowUpRight size={13}/></Link>}
        {signedIn ? <button className="workspace-logout" type="button" onClick={logout} disabled={busy}><LogOut size={14}/> {busy ? "Signing out…" : "Log out"}</button> : <Link className="workspace-logout" href="/account">Sign up</Link>}
      </div>
    );
  }

  return (
    <div className="marketing-actions">
      {signedIn ? <>
        <Link href="/dashboard">Open workspace <ArrowUpRight size={14}/></Link>
        <button className="nav-signup nav-logout" type="button" onClick={logout} disabled={busy}><LogOut size={14}/> {busy ? "Signing out…" : "Log out"}</button>
      </> : <>
        <Link href="/account?mode=signin">Log in</Link>
        <Link className="nav-signup" href="/account">Sign up <ArrowUpRight size={15}/></Link>
      </>}
    </div>
  );
}
