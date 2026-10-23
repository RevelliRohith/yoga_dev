import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { loadTrainer } from "@/lib/admin/trainer-data";
import { isUuid, formatDays, formatTime } from "@/lib/admin/management";
import { LoadError, ManagementHeading, SaveNotice, StatusBadge } from "../../management-ui";
import { loadTrainerOnboarding } from "@/lib/admin/onboarding-data";
import { SetupAction } from "../../onboarding-forms";
import { AssignmentForm } from "../../trainer-forms";

export const metadata = { title: "Trainer profile | Arkaprajna Yogashala" };
export default async function TrainerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const result = await loadTrainer(id);
  if (result.error) return <LoadError message={result.error} href={`/admin/trainers/${id}`} />;
  if (!result.data) notFound();
  const { trainer, batches } = result.data;
  const onboarding = await loadTrainerOnboarding(id);
  const assigned = batches.filter(b => b.trainer_id === id);
  const { notice } = await searchParams;
  return <><Link className="admin-back" href="/admin/trainers">← All trainers</Link><ManagementHeading title={trainer.full_name} description="Teaching profile and current batch assignments." action={{ href: `/admin/trainers/${id}/edit`, label: "Edit profile" }} /><SaveNotice notice={notice} noun="Trainer profile" />{notice === "assignment" && <p className="admin-notice" role="status">Batch assignment updated successfully.</p>}
    <section className="trainer-profile management-panel" aria-label="Trainer details"><div className="trainer-profile-header"><h2>About this trainer</h2><StatusBadge active={trainer.is_active} /></div><dl className="trainer-details">{[["Phone", trainer.phone], ["Specialization", trainer.specialization], ["Qualifications", trainer.qualifications], ["Experience", trainer.years_of_experience === null ? null : `${trainer.years_of_experience} years`], ["Biography", trainer.biography]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section>
    {(["invitation", "recovery", "repaired"].includes(notice ?? "")) && <p className="admin-notice" role="status">{notice === "repaired" ? "Profile link repaired. No email was requested." : "Setup email request accepted. Delivery is not guaranteed; check the recipient mailbox before retrying."}</p>}
    <section className="trainer-profile management-panel" aria-label="Secure onboarding"><h2>Account setup</h2><p className="admin-muted">{onboarding.message}</p>{onboarding.available && <SetupAction id={id} intent={onboarding.confirmed ? "recovery" : "invite"} label={onboarding.confirmed ? "Send password recovery" : "Retry invitation"} disabled={!trainer.is_active} />}</section>
    <section className="trainer-profile management-panel" aria-label="Batch assignments"><h2>Assigned batches <span className="admin-muted">({assigned.length})</span></h2><p className="admin-muted">Unassigning changes only the trainer assignment. Students and schedules are preserved.</p>
      {!trainer.is_active && <p className="admin-notice">This trainer is inactive. Existing assignments are retained, but trainer access is blocked. Activate the profile before adding assignments.</p>}
      <div className="trainer-assigned-list">{assigned.length ? assigned.map(batch => <article key={batch.id}><div><Link className="management-text-link" href={`/admin/batches/${batch.id}/edit`}>{batch.name}</Link><p>{formatTime(batch.start_time ?? "")} – {formatTime(batch.end_time ?? "")}</p><small className="admin-muted">{formatDays(batch.days_of_week ?? [])}</small></div><div><StatusBadge active={batch.is_active} /><AssignmentForm trainerId={id} batches={[]} assignedBatch={batch} active={trainer.is_active} /></div></article>) : <p className="admin-muted">No batches assigned yet.</p>}</div>
      <div className="trainer-add-assignment"><h3>Assign a batch</h3><AssignmentForm trainerId={id} batches={batches} active={trainer.is_active} /></div>
    </section>
  </>;
}
