"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ReconcileActivity({ references }: { references: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reconcile() {
    if (busy || !references.length) return;
    setBusy(true);
    setMessage("");
    try {
      const results = await Promise.all(references.map(async (tx_ref) => {
        const response = await fetch("/api/funding/reconcile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tx_ref }),
        });
        return response.json();
      }));
      const verified = results.filter((result) => result.paymentStatus === "successful").length;
      setMessage(verified ? `${verified} payment(s) verified. Refreshing activity…` : "No additional payments have been verified yet.");
      router.refresh();
    } catch {
      setMessage("Could not verify payments right now. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (references.length) void reconcile();
    // Run once when the activity page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      <button type="button" onClick={() => void reconcile()} disabled={busy || !references.length}
        style={{ border: "1px solid var(--border, #393747)", borderRadius: 10, padding: "10px 14px", background: "transparent", color: "inherit", cursor: busy || !references.length ? "not-allowed" : "pointer", opacity: busy || !references.length ? .55 : 1 }}>
        {busy ? "Checking payments…" : "Refresh & verify"}
      </button>
      {message ? <small role="status">{message}</small> : null}
    </div>
  );
}
