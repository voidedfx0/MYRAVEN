"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ActivityBackButton() {
  const router = useRouter();
  return (
    <button type="button" className="activity-back-button" aria-label="Go back to previous page" onClick={() => {
      if (window.history.length > 1) router.back();
      else router.push("/dashboard");
    }}>
      <ArrowLeft size={15} aria-hidden="true" />
    </button>
  );
}
