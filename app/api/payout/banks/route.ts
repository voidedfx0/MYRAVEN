import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import countriesData from "@/src/data/funding-countries.json";

export const dynamic = "force-dynamic";
const countries = countriesData.countries as Array<{ code: string; name: string }>;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view bank options." }, { status: 401 });
  const country = (new URL(request.url).searchParams.get("country") ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || !countries.some((item) => item.code === country)) {
    return NextResponse.json({ error: "Choose a valid country." }, { status: 400 });
  }
  try {
    // Provider-independent reference directory. Payout availability is checked separately.
    const response = await fetch("https://raw.githubusercontent.com/AbYT101/Global-bank-data/main/data/" + country + ".json", {
      next: { revalidate: 86400 }, signal: AbortSignal.timeout(12000),
    });
    if (response.status === 404) return NextResponse.json({
      supported: false, banks: [],
      message: "Our reference directory does not have published bank records for this country yet.",
      source: "Global-bank-data",
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
    if (!response.ok) throw new Error("Directory source unavailable");
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("Invalid directory response");
    const unique = new Map<string, { id: string; code: string; name: string }>();
    for (const item of payload as Array<Record<string, unknown>>) {
      const name = String(item.bank_name ?? "").trim();
      const swift = String(item.swift_code ?? "").trim().toUpperCase();
      if (!name) continue;
      const id = swift || name.toLowerCase();
      if (!unique.has(id)) unique.set(id, { id, code: swift || id, name });
    }
    const banks = [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({
      supported: banks.length > 0, banks,
      message: banks.length + " bank records loaded from MYRAVEN's global reference directory. Search by typing a bank name.",
      source: "Global-bank-data",
      sourceUrl: "https://github.com/AbYT101/Global-bank-data",
      payoutEnabled: false,
    }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "The global bank directory is temporarily unavailable. Try again shortly." }, { status: 502 });
  }
}
