import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: notifications, error } = await supabase.from("notifications")
    .select("id,category,title,body,data,read_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <main className="app-frame">
      <section className="main-area">
        <header className="top-header">
          <div className="breadcrumb"><Link href="/dashboard">Workspace</Link><span>/</span><b>Notifications</b></div>
          <Link className="connect-button" href="/dashboard">Back to overview</Link>
        </header>
        <div className="content-wrap">
          <section className="welcome-row"><div><div className="eyebrow">MYRAVEN · INBOX</div><h1>Notifications</h1><p>Payment updates and account alerts.</p></div></section>
          <section className="panel funding-hub-panel">
            {error ? <p className="funding-disclaimer">Notifications are temporarily unavailable. Refresh to try again.</p>
              : notifications?.length ? <div className="funding-history-list">{notifications.map((item) => (
                <article className="funding-history-item" key={item.id}>
                  <span className="funding-history-mark">◉</span>
                  <span className="funding-history-copy"><b>{item.title}</b><small>{item.body}</small><small>{new Date(item.created_at).toLocaleString()}</small></span>
                  <span className="funding-history-status"><b>{item.read_at ? "Read" : "New"}</b><small>{item.category}</small></span>
                </article>
              ))}</div> : <p className="funding-history-empty">You’re all caught up. New transfer and funding alerts will appear here.</p>}
          </section>
        </div>
      </section>
    </main>
  );
}
