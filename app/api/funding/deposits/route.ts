import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to view your funding history." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("funding_deposits")
    .select("id,funding_method,input_kind,input_currency,input_amount,target_asset,credited_output_amount,status,failure_code,provider_code,provider_reference,chain_code,created_at,updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(new URL(request.url).searchParams.get("all") === "1" ? 1000 : 10);

  if (error) {
    return NextResponse.json({ error: "Funding history is temporarily unavailable." }, { status: 500 });
  }

  return NextResponse.json({ deposits: data ?? [] });
}
