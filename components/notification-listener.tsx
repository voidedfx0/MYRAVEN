"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";

type Notice = { id: string; title: string; body: string; category?: string };

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const now = context.currentTime;
    [659.25, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + index * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.11, now + index * 0.12 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.42);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.12);
      oscillator.stop(now + index * 0.12 + 0.45);
    });
    window.setTimeout(() => { void context.close(); }, 900);
  } catch { /* Browser audio may be blocked until the user interacts with the page. */ }
}

export default function NotificationListener() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const response = await fetch("/api/notifications/latest", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        const incoming: Notice[] = Array.isArray(data.notifications) ? data.notifications : [];
        if (!active || !incoming.length) return;
        const fresh = incoming.filter((item) => !seen.current.has(item.id));
        incoming.forEach((item) => seen.current.add(item.id));
        if (!fresh.length) return;
        const latest = fresh[0];
        setNotice(latest);
        playChime();
      } catch { /* Keep the workspace usable while notifications reconnect. */ }
    }
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  if (!notice) return null;
  return <div className="mrv-live-notice" role="status" aria-live="polite">
    <span className="mrv-live-notice-icon"><Bell size={17}/></span>
    <span className="mrv-live-notice-copy"><b>Hey there! 👋 {notice.title}</b><small>{notice.body}</small></span>
    <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15}/></button>
    <span className="mrv-live-notice-progress"/>
  </div>;
}
