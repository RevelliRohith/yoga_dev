import Link from "next/link";
import { loadTrainerDashboard } from "@/lib/trainer/dashboard";
import { formatDays, formatTime } from "@/lib/admin/management";
import { StatusBadge } from "@/app/admin/(protected)/management-ui";
export default async function TrainerDashboardPage() {
  const result = await loadTrainerDashboard();
  const { profile, data } = result;
  return <><div className="admin-heading"><div><p className="admin-eyebrow">YOUR TEACHING PRACTICE</p><h1>Welcome, {profile.full_name}.</h1><p className="admin-muted">A clear view of the classes and students entrusted to you.</p></div></div>{!data ? <section className="management-empty" role="alert"><h2>Your workspace is temporarily unavailable.</h2><p>{result.error}</p><Link className="admin-logout" href="/trainer">Try again</Link></section> : <>
    <section className="trainer-stats" aria-label="Teaching summary">{[["Assigned batches", data.batches.length], ["Active batches", data.batches.filter(b => b.is_active).length], ["Assigned students", data.students.length], ["Active students", data.students.filter(s => s.status === "active").length]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section aria-label="Assigned batches"><div className="trainer-section-heading"><h2>Your weekly rhythm.</h2><Link className="management-text-link" href="/trainer/roster">View student roster →</Link></div>{!data.batches.length ? <div className="management-panel management-empty"><h2>Your classes will appear here.</h2><p>Your administrator has not assigned any batches yet.</p></div> : <div className="trainer-batch-grid">{data.batches.map(batch => <article className="management-panel trainer-batch-card" key={batch.id}><div className="trainer-profile-header"><h3>{batch.name}</h3><StatusBadge active={batch.is_active} /></div><p className="admin-muted">{batch.program_name || "Program not available"}</p><p className="trainer-schedule">{formatTime(batch.start_time ?? "")} – {formatTime(batch.end_time ?? "")}</p><p>{formatDays(batch.days_of_week ?? [])}</p><div className="trainer-section-heading"><span className="admin-muted">{data.students.filter(s => s.batch_id === batch.id).length} students</span><Link className="management-text-link" href={`/trainer/roster?batch=${batch.id}`}>View roster</Link></div></article>)}</div>}</section>
  </>}</>;
}
