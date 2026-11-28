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

  const secretKey = process.env.FLW_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ supported: false, banks: [], message: "The bank directory provider is not connected yet." }, { status: 503 });
  }

  try {
    const response = await fetch("https://api.flutterwave.com/v3/banks/" + country + "?include_provider_type=1", {
      headers: { Authorization: "Bearer " + secretKey, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.status !== "success" || !Array.isArray(payload?.data)) {
      return NextResponse.json({
        supported: false,
        banks: [],
        message: "No bank directory is available through the current payout provider for this country.",
      }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }
    const banks = payload.data
      .filter((item: Record<string, unknown>) => {
        const type = String(item.provider_type ?? item.type ?? "").toLowerCase();
        return !type || type === "bank";
      })
      .map((item: Record<string, unknown>) => ({
        id: String(item.id ?? item.code ?? item.name),
        code: String(item.code ?? ""),
        name: String(item.name ?? ""),
      }))
      .filter((item: { id: string; code: string; name: string }) => item.name && item.code)
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return NextResponse.json({
      supported: banks.length > 0,
      banks,
      message: banks.length ? "Bank list supplied by Flutterwave." : "No banks are currently listed for this country.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The bank directory is temporarily unavailable. Try again shortly." }, { status: 502 });
  }
}
