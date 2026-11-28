"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, House } from "lucide-react";

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1 &&
        document.referrer.startsWith(window.location.origin)) {
      router.back();
      return;
    }
    router.push("/dashboard");
  }

  return (
    <nav className="global-navigation-controls" aria-label="Page navigation">
      {pathname !== "/" ? (
        <button type="button" onClick={goBack} className="global-back-button" aria-label="Go back">
          <ArrowLeft size={16} aria-hidden="true" /><span>Back</span>
        </button>
      ) : null}
      <button type="button" onClick={() => router.push("/dashboard")} className="global-home-button" aria-label="Go to home dashboard">
        <House size={15} aria-hidden="true" /><span>Home</span>
      </button>
    </nav>
  );
}
