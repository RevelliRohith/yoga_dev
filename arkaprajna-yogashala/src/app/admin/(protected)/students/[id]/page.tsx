import { loadStudio } from "@/lib/studio/admin-data";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { loadStudentForm } from "@/lib/admin/student-data";
import { isUuid } from "@/lib/admin/management";
import {
  LoadError,
  ManagementHeading,
  SaveNotice,
  StatusBadge,
} from "../../management-ui";
export const metadata = { title: "Student profile | Arkaprajna Yogashala" };
export default async function StudentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const result = await loadStudentForm(id);
  if (!result.data)
    return <LoadError message={result.error} href={`/admin/students/${id}`} />;
  const s = result.data.record;
  if (!s) notFound();
  const history = await loadStudio("audit",id);
  const notice = (await searchParams).notice;
  const program = result.data.programs.find((p) => p.id === s.program_id),
    batch = result.data.batches.find((b) => b.id === s.batch_id);
  const describeEnrollment = (value: unknown) => {
    const v = value as {
      program_id?: string;
      batch_id?: string;
      status?: string;
    } | null;
    if (!v) return "No previous enrollment";
    return `${result.data!.programs.find((p) => p.id === v.program_id)?.name || "No available program"} / ${result.data!.batches.find((b) => b.id === v.batch_id)?.name || "No available batch"} / ${v.status || "Status unavailable"}`;
  };
  return (
    <>
      <Link href="/admin/students" className="admin-back">
        ← All students
      </Link>
      <ManagementHeading
        title={s.full_name}
        description={`Studio code ${s.student_code}`}
        action={{ href: `/admin/students/${id}/edit`, label: "Edit student" }}
      />
      <SaveNotice notice={notice} noun="Student" />
      <section className="management-panel trainer-profile">
        <div className="trainer-profile-header">
          <h2>Registration details</h2>
          <StatusBadge active={s.status === "active"} />
        </div>
        <dl className="trainer-details">
          {[
            ["Mobile", s.mobile],
            ["Email", s.email],
            ["Date of birth", s.date_of_birth],
            ["Gender", s.gender],
            ["Guardian", s.guardian_name],
            ["Guardian mobile", s.guardian_mobile],
            ["Program", program?.name],
            ["Batch", batch?.name],
            ["Joining date", s.joining_date],
            ["Address", s.address],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value || "Not provided"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="management-panel trainer-profile">
        <h2>Fees & receipts</h2>
        <p>
          <Link href={`/admin/fees/students/${id}`}>
            Open administrator fee ledger and receipt history ?
          </Link>
        </p>
      </section>
      <section className="management-panel trainer-profile">
        <h2>Enrollment history</h2>
        <p>
          Registered {s.created_at.slice(0, 10)}. Earlier changes cannot be
          reconstructed from the current record.
        </p>
        {history.data ? (
          history.data.audit
            .filter((a) => a.source === "students" && a.entity_id === id)
            .map((a) => {
              const detail = a.details as { before?: unknown; after?: unknown };
              return (
                <div key={a.id} className="studio-card">
                  <p>
                    {a.created_at.slice(0, 10)}:{" "}
                    {a.action === "INSERT"
                      ? "Registration recorded"
                      : "Enrollment updated"}
                  </p>
                  <p>From: {describeEnrollment(detail.before)}</p>
                  <p>To: {describeEnrollment(detail.after)}</p>
                </div>
              );
            })
        ) : (
          <p>
            Detailed enrollment history awaits the approved operations schema.
            No historical changes are invented.
          </p>
        )}
      </section>
    </>
  );
}
