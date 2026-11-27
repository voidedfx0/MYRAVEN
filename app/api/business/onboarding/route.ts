import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const businessTypes = new Set(["limited_company", "sole_proprietor", "partnership", "nonprofit", "other"]);

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function getOwnerBusiness() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  if (profile?.account_type !== "business") return { error: NextResponse.json({ error: "A business workspace is required." }, { status: 403 }) };
  const { data: business, error: businessError } = await supabase.from("business_profiles")
    .select("id,business_name,legal_name,country_code,website_url,business_type,registration_number,industry,business_description,address_line,city,postal_code,operating_countries,onboarding_status,verification_status")
    .eq("owner_user_id", user.id).maybeSingle();
  if (businessError || !business) return { error: NextResponse.json({ error: "Business profile not found." }, { status: 404 }) };
  return { supabase, business };
}

export async function GET() {
  const result = await getOwnerBusiness();
  if ("error" in result) return result.error;
  return NextResponse.json({ business: result.business });
}

export async function PATCH(request: Request) {
  const result = await getOwnerBusiness();
  if ("error" in result) return result.error;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const businessName = clean(body.businessName, 120) || result.business.business_name;
  const legalName = clean(body.legalName, 160) || result.business.legal_name || "";
  const countryCode = (clean(body.countryCode, 2) || result.business.country_code || "").toUpperCase();
  const businessType = clean(body.businessType, 40) || result.business.business_type || "other";
  const registrationNumber = clean(body.registrationNumber, 80);
  const industry = clean(body.industry, 80) || result.business.industry || "";
  const description = clean(body.description, 500);
  const website = clean(body.website, 200);
  const address = clean(body.address, 180);
  const city = clean(body.city, 100);
  const postalCode = clean(body.postalCode, 24);
  const operatingCountries = Array.isArray(body.operatingCountries)
    ? [...new Set(body.operatingCountries.filter((v: unknown): v is string => typeof v === "string" && /^[A-Za-z]{2}$/.test(v)).map((v: string) => v.toUpperCase()))].slice(0, 20)
    : [];
  const completed = body.submit === true;

  if (!businessName || (completed && (businessName.length < 2 || legalName.length < 2 || !/^[A-Z]{2}$/.test(countryCode) || !businessTypes.has(businessType) || industry.length < 2))) {
    return NextResponse.json({ error: "Complete the business name, legal name, country, business type and industry." }, { status: 400 });
  }
  if (website && !/^https:\/\//i.test(website)) return NextResponse.json({ error: "Website must begin with https://." }, { status: 400 });
  const { error } = await result.supabase.from("business_profiles").update({
    business_name: businessName, legal_name: legalName, country_code: countryCode,
    business_type: businessType, registration_number: registrationNumber || null,
    industry, business_description: description || null, website_url: website || null,
    address_line: address || null, city: city || null, postal_code: postalCode || null,
    operating_countries: operatingCountries,
    onboarding_status: completed ? "profile_completed" : "draft",
    profile_completed_at: completed ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("id", result.business.id);
  if (error) return NextResponse.json({ error: "Could not save business profile." }, { status: 400 });
  return NextResponse.json({ ok: true, onboardingStatus: completed ? "profile_completed" : "draft", verificationStatus: result.business.verification_status });
}
