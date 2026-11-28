"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

type Notice = { id: string; title: string; body: string; category?: string };

function playChime(context: AudioContext | null) {
  try {
    if (!context) return;
    if (context.state === "suspended") void context.resume();
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
  } catch { /* Browser audio may be blocked until the user interacts with the page. */ }
}

export default function NotificationListener() {
  const router = useRouter();
  const pathname = usePathname();
  const [notice, setNotice] = useState<Notice | null>(null);
  const seen = useRef(new Set<string>());
  const audioContext = useRef<AudioContext | null>(null);
  useEffect(() => {
    let active = true;
    function unlockAudio() {
      if (audioContext.current) return;
      const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      audioContext.current = new AudioContextClass();
      void audioContext.current.resume();
    }
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
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
        playChime(audioContext.current);
        if (pathname === "/notifications") router.refresh();
      } catch { /* Keep the workspace usable while notifications reconnect. */ }
    }
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("pointerdown", unlockAudio); window.removeEventListener("keydown", unlockAudio); };
  }, [pathname, router]);
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
