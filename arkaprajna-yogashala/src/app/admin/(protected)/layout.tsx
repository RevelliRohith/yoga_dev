import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { LogoutForm } from "../auth-forms";
import { AdminNavigation, AdminBreadcrumb } from "../admin-navigation";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand"><span className="admin-symbol" aria-hidden="true">✳</span><span>ARKAPRAJNA<small>YOGASHALA</small></span></Link>
      <p className="admin-eyebrow">YOUR WORKSPACE</p>
      <AdminNavigation />
      <div className="admin-sidebar-bottom"><p>A little clarity.<br />More room to grow.</p><Link href="/">Visit website ↗</Link></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><AdminBreadcrumb /><div className="admin-account"><span className="admin-avatar" aria-hidden="true">A</span><span className="admin-account-label">Administrator<small>{user.email}</small></span><LogoutForm /></div></header>
      <main id="admin-content" className="admin-content">{children}</main>
      <footer className="admin-dashboard-footer">Arkaprajna Yogashala <span>Made for a mindful community.</span></footer>
    </div>
  </div>;
}
