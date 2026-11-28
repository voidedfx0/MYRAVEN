import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Sign in before looking up a MYRAVEN recipient." }, { status: 401 });
  }

  let body: { myravenId?: string; identifier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid lookup request." }, { status: 400 });
  }

  const identifier = String(body.identifier ?? body.myravenId ?? "").trim().toUpperCase();
  const isMyravenId = /^[A-Z]{2,12}[0-9]{4}$/.test(identifier);
  const isAccountNumber = /^[0-9]{10}$/.test(identifier);
  if (!isMyravenId && !isAccountNumber) {
    return NextResponse.json({ error: "Enter a valid MYRAVEN ID or 10-digit account number." }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("lookup_myraven_recipient", {
    p_identifier: identifier,
  });

  if (error) {
    return NextResponse.json({ error: "Recipient lookup is temporarily unavailable." }, { status: 503 });
  }

  const recipient = Array.isArray(data) ? data[0] : null;
  if (!recipient) {
    return NextResponse.json({ error: "No MYRAVEN account matched those details." }, { status: 404 });
  }

  return NextResponse.json({
    recipient: {
      myravenId: recipient.myraven_id,
      accountNumber: recipient.account_number,
      displayName: recipient.display_name,
      countryCode: recipient.country_code,
      solanaAddress: recipient.solana_address,
      walletStatus: recipient.wallet_status,
    },
    verification: "myraven_profile_matched",
    note: "The account details match a MYRAVEN profile. Confirm the recipient name before any transfer.",
  });
}
