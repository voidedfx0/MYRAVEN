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
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={goBack}
        aria-label="Go back"
        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-black/10 bg-white px-4 text-sm font-medium text-neutral-700 shadow-sm transition hover:border-black/20 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        <span>Back</span>
      </button>
    </div>
  );
}
