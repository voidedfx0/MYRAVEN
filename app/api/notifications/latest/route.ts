import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ notifications: [] }, { status: 200, headers: { "Cache-Control": "no-store" } });

  const { data, error } = await supabase.from("notifications")
    .select("id,title,body,category,data,created_at")
    .eq("user_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return NextResponse.json({ error: "Notifications are temporarily unavailable." }, { status: 503 });

  const notifications = data ?? [];
  if (notifications.length) {
    await supabase.from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .in("id", notifications.map((item) => item.id));
  }
  return NextResponse.json({ notifications }, { headers: { "Cache-Control": "no-store" } });
}
