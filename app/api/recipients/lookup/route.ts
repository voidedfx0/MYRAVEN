import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in before looking up a MYRAVEN recipient." }, { status: 401 });
  }

  let body: { myravenId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid lookup request." }, { status: 400 });
  }

  const myravenId = typeof body.myravenId === "string" ? body.myravenId.trim().toUpperCase() : "";
  if (!/^MRV-[A-F0-9]{10}$/.test(myravenId)) {
    return NextResponse.json({ error: "Enter a valid MYRAVEN ID (MRV- followed by 10 letters or numbers)." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("lookup_myraven_recipient", {
    p_myraven_id: myravenId,
  });

  if (error) {
    return NextResponse.json({ error: "Recipient lookup is temporarily unavailable." }, { status: 503 });
  }

  const recipient = Array.isArray(data) ? data[0] : null;
  if (!recipient) {
    return NextResponse.json({ error: "No MYRAVEN account matched that ID." }, { status: 404 });
  }

  return NextResponse.json({
    recipient: {
      myravenId: recipient.myraven_id,
      displayName: recipient.display_name,
      countryCode: recipient.country_code,
    },
    verification: "myraven_profile_matched",
    note: "The MYRAVEN ID and profile match. This does not independently certify the person's identity or trustworthiness.",
  });
}
