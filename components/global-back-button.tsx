"use client";

import { usePathname, useRouter } from "next/navigation";
import { House } from "lucide-react";

export default function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  if (!pathname) return null;


  return (
    <div className="global-back-wrap">
      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        aria-label="Return to home"
        className="global-back-button"
      >
        <House size={15} aria-hidden="true" />
        <span>Home</span>
      </button>
    </div>
  );
}
