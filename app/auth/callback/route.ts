import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/account";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      const redirectOrigin = !isLocal && forwardedHost ? "https://" + forwardedHost : origin;
      return NextResponse.redirect(new URL(safeNext, redirectOrigin));
    }
  }

  const errorUrl = new URL("/account", origin);
  errorUrl.searchParams.set("auth", "callback_error");
  return NextResponse.redirect(errorUrl);
}
