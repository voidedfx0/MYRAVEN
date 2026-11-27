import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("account_type,display_name,myraven_id").eq("id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not load account type." }, { status: 503 });
  const accountType = profile?.account_type === "business" ? "business" : "personal";
  let business = null;
  if (accountType === "business") {
    const { data } = await supabase.from("business_profiles")
      .select("id,business_name,verification_status,country_code")
      .eq("owner_user_id", user.id).limit(1).maybeSingle();
    business = data;
  }
  return NextResponse.json({ accountType, profile, business });
}
