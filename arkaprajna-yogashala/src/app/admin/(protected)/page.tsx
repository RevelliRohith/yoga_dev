import Link from "next/link";
import { loadOverviewCounts } from "@/lib/admin/data";

export default async function DashboardPage() {
  const { data: counts, error } = await loadOverviewCounts();
  return <>
    <div className="admin-heading"><div><p className="admin-eyebrow">A SPACE TO GROW</p><h1>Your studio, at a glance.</h1><p className="admin-muted">Welcome to your administration space. Let’s make room for what matters.</p></div><span className="admin-pill">ADMIN OVERVIEW</span></div>
    <section className="admin-welcome"><div><p className="admin-eyebrow">PRACTICE. CONNECT. FLOURISH.</p><h2>Every great community<br />begins with intention.</h2><p>Shape your yoga offerings and bring a steady rhythm to your studio’s weekly practice.</p><div className="management-welcome-links"><Link href="/admin/programs">Manage programs →</Link><Link href="/admin/batches">Manage batches →</Link></div></div><span className="admin-welcome-art" aria-hidden="true">✳</span></section>
    {error && <p className="admin-alert" role="status">{error} Counts are shown as unavailable rather than zero.</p>}
    <section className="admin-stats" aria-label="Studio overview">
      <article className="admin-stat"><div><h2>Programs</h2><span>01</span></div><p className="admin-stat-value">{counts?.programs ?? "—"}</p><p className="admin-muted">{counts ? `${counts.activePrograms ?? "Unavailable"} active programs` : "Count unavailable"}</p><Link className="management-text-link" href="/admin/programs">Explore programs →</Link></article>
      <article className="admin-stat"><div><h2>Batches</h2><span>02</span></div><p className="admin-stat-value">{counts?.batches ?? "—"}</p><p className="admin-muted">{counts ? `${counts.activeBatches ?? "Unavailable"} active batches` : "Count unavailable"}</p><Link className="management-text-link" href="/admin/batches">View schedule →</Link></article>
      <article className="admin-stat"><div><h2>Students</h2><span>03</span></div><p className="admin-stat-value" aria-label="Not connected">—</p><p className="admin-muted">Your growing community</p><span className="admin-coming">Coming in a future update</span></article>
    </section>
    <section className="admin-note"><span aria-hidden="true">◈</span><div><h2>A considered workspace</h2><p>Program and batch totals reflect your studio records. Inactive records remain available to administrators, preserving your studio’s history.</p></div></section>
  </>;
}
