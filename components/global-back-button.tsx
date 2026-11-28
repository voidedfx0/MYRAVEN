"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/dashboard") return null;

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push("/dashboard");
  }

  return (
    <div className="global-back-wrap">
      <button
        type="button"
        onClick={goBack}
        aria-label="Go back"
        className="global-back-button"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );
}
