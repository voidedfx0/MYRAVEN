"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function GlobalBackButton() {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      title="Go back"
      className="fixed left-3 top-16 z-[100] flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white/95 text-gray-700 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 md:left-36 md:top-4 md:h-8 md:w-8 dark:border-white/15 dark:bg-neutral-900/95 dark:text-gray-200 dark:hover:bg-neutral-800"
    >
      <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
