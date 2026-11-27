import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AccountType = "personal" | "business";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to set up a workspace." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const accountType: AccountType = body.accountType === "business" ? "business" : "personal";
  const displayName = (typeof body.displayName === "string" ? body.displayName : user.user_metadata?.display_name ?? "").trim().slice(0, 60);
  const businessName = (typeof body.businessName === "string" ? body.businessName : user.user_metadata?.business_name ?? "").trim().slice(0, 120);
  const rawCountry = typeof body.countryCode === "string" ? body.countryCode : user.user_metadata?.country_code ?? "";
  const countryCode = /^[A-Za-z]{2}$/.test(rawCountry) ? rawCountry.toUpperCase() : null;

  if (accountType === "business" && !businessName) {
    return NextResponse.json({ error: "Enter your business or organisation name to create a business workspace." }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").update({
    account_type: accountType,
    ...(displayName ? { display_name: displayName } : {}),
    ...(countryCode ? { country_code: countryCode } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (profileError) return NextResponse.json({ error: "Could not save your account type. " + profileError.message }, { status: 400 });

  if (accountType === "business") {
    const { data: existing, error: lookupError } = await supabase.from("business_profiles")
      .select("id").eq("owner_user_id", user.id).limit(1).maybeSingle();
    if (lookupError) return NextResponse.json({ error: "Could not load your business workspace." }, { status: 400 });

    let businessId = existing?.id;
    if (!businessId) {
      const { data: created, error: createError } = await supabase.from("business_profiles").insert({
        owner_user_id: user.id, business_name: businessName,
        legal_name: businessName, country_code: countryCode, verification_status: "unverified",
      }).select("id").single();
      if (createError) return NextResponse.json({ error: "Could not create business profile. " + createError.message }, { status: 400 });
      businessId = created.id;
    } else {
      await supabase.from("business_profiles").update({
        business_name: businessName, legal_name: businessName, country_code: countryCode,
      }).eq("id", businessId);
    }

    const { data: membership } = await supabase.from("business_members")
      .select("id").eq("business_id", businessId).eq("user_id", user.id).maybeSingle();
    if (!membership) {
      const { error: memberError } = await supabase.from("business_members").insert({
        business_id: businessId, user_id: user.id, role: "owner", membership_status: "active",
      });
      if (memberError) return NextResponse.json({ error: "Business profile created, but owner access could not be prepared." }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, accountType, redirectTo: accountType === "business" ? "/business" : "/dashboard" });
}
