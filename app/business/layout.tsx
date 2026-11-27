import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/account?type=business&mode=signin");
  const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).maybeSingle();
  if (profile?.account_type !== "business") redirect("/dashboard");
  return children;
}
