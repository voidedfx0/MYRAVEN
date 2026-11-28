import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const nickname = typeof body.nickname === "string" ? body.nickname.trim().slice(0, 60) : "";
  const preferredCurrency = typeof body.preferredCurrency === "string" && /^[A-Z]{3}$/.test(body.preferredCurrency) ? body.preferredCurrency : "USD";
  const metadata = {
    ...(user.user_metadata ?? {}),
    nickname,
    display_name: nickname || [user.user_metadata?.first_name, user.user_metadata?.last_name].filter(Boolean).join(" "),
    preferred_currency: preferredCurrency,
    payment_alerts: body.paymentAlerts !== false,
    security_alerts: body.securityAlerts !== false,
    product_updates: body.productUpdates === true,
  };
  const { error: authUpdateError } = await supabase.auth.updateUser({ data: metadata });
  if (authUpdateError) return NextResponse.json({ error: authUpdateError.message }, { status: 400 });
  const { error: profileError } = await supabase.from("profiles").update({
    display_name: metadata.display_name,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (profileError) return NextResponse.json({ error: "Nickname saved to your account, but profile sync failed. " + profileError.message }, { status: 503 });
  return NextResponse.json({ ok: true, nickname, displayName: metadata.display_name });
}
