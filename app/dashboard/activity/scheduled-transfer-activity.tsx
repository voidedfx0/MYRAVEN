"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "myraven:scheduled-send";
type ScheduledSend = { requestId: string; amount: string; recipientProfile: { displayName?: string | null }; recipientReference: string; expiresAt: number };

export default function ScheduledTransferActivity() {
  const router = useRouter();
  const [scheduled, setScheduled] = useState<ScheduledSend | null>(null);
  const [seconds, setSeconds] = useState(0);
  const redirected = useRef(false);
  useEffect(() => {
    const read = () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) { setScheduled(null); return; }
        const item = JSON.parse(raw) as ScheduledSend;
        if (!item.requestId || !item.expiresAt) { window.localStorage.removeItem(STORAGE_KEY); setScheduled(null); return; }
        setScheduled(item);
        setSeconds(Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000)));
      } catch { window.localStorage.removeItem(STORAGE_KEY); setScheduled(null); }
    };
    read();
    const interval = window.setInterval(read, 500);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!scheduled || seconds > 0 || redirected.current) return;
    redirected.current = true;
    router.replace("/dashboard?resumeScheduledSend=1");
  }, [scheduled, seconds, router]);
  if (!scheduled) return null;
  const remaining = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  function cancel() {
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (!current || (JSON.parse(current) as ScheduledSend).requestId !== scheduled?.requestId) return;
    } catch { /* Clear malformed schedule below. */ }
    window.localStorage.removeItem(STORAGE_KEY);
    setScheduled(null);
  }
  return (
    <article className="funding-history-item scheduled-send-activity">
      <span className="funding-history-mark">◷</span>
      <span className="funding-history-copy">
        <b>Transfer scheduled · {scheduled.amount} SOL</b>
        <small>To {scheduled.recipientProfile?.displayName || scheduled.recipientReference} · Auto-sends when the timer ends</small>
      </span>
      <span className="funding-history-status status-pending">
        <b>{remaining} remaining</b>
        <button type="button" className="cancel-review" onClick={cancel}>Cancel transfer</button>
      </span>
    </article>
  );
}
