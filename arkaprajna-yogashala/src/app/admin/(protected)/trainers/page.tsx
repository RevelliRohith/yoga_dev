import Link from "next/link";
import { loadTrainers } from "@/lib/admin/trainer-data";
import { parseFilters, type SearchValues } from "@/lib/admin/management";
import { LoadError, ManagementHeading, Pagination, SearchFilters, StatusBadge, SummaryCards } from "../management-ui";

export const metadata = { title: "Trainers | Arkaprajna Yogashala" };
export default async function TrainersPage({ searchParams }: { searchParams: Promise<SearchValues> }) {
  const filters = parseFilters(await searchParams);
  const result = await loadTrainers(filters);
  return <><ManagementHeading title="The people behind the practice." description="Care for your teaching team and bring clarity to their weekly assignments." action={{ href: "/admin/trainers/new", label: "Create trainer" }} />
    {!result.data ? <LoadError message={result.error} href="/admin/trainers" /> : <>
      <SummaryCards noun="Trainers" total={result.data.total} active={result.data.active} />
      <section className="management-panel" aria-label="Trainers"><SearchFilters path="/admin/trainers" filters={filters} />
        {!result.data.records.length ? <div className="management-empty"><span aria-hidden="true">✳</span><h2>{filters.q || filters.status !== "all" || filters.page > 1 ? "No trainers match this view." : "A space for your teaching team."}</h2><p>{filters.q || filters.status !== "all" || filters.page > 1 ? "Try another name or reset the filters." : "Invite a teacher to create their own password and join your studio."}</p><Link className="management-text-link" href={filters.q || filters.status !== "all" || filters.page > 1 ? "/admin/trainers" : "/admin/trainers/new"}>{filters.q || filters.status !== "all" || filters.page > 1 ? "Reset view" : "Create trainer"}</Link></div> : <div className="management-table-wrap" role="region" aria-label="Trainer profiles" tabIndex={0}><table className="management-table trainer-table"><caption className="management-sr-only">Trainer contacts, experience, status and assigned batches</caption><thead><tr><th scope="col">Trainer</th><th scope="col">Practice & qualifications</th><th scope="col">Experience</th><th scope="col">Assigned batches</th><th scope="col">Status</th><th scope="col">Profile</th></tr></thead><tbody>{result.data.records.map(trainer => {
          const batches = result.data!.batches.filter(batch => batch.trainer_id === trainer.id);
          return <tr key={trainer.id}><th scope="row"><Link href={`/admin/trainers/${trainer.id}`}>{trainer.full_name}</Link><small>{trainer.phone || "Phone not provided"}</small></th><td><span className="trainer-text">{trainer.specialization || "Specialization not provided"}</span><small className="trainer-text">{trainer.qualifications || "Qualifications not provided"}</small></td><td>{trainer.years_of_experience === null ? "Not provided" : `${trainer.years_of_experience} ${trainer.years_of_experience === 1 ? "year" : "years"}`}</td><td>{batches.length ? batches.map(batch => <Link className="trainer-batch-link" key={batch.id} href={`/admin/batches/${batch.id}/edit`}>{batch.name}{!batch.is_active ? " (inactive)" : ""}</Link>) : <span className="admin-muted">Unassigned</span>}</td><td><StatusBadge active={trainer.is_active} /></td><td><Link className="admin-logout" href={`/admin/trainers/${trainer.id}`} aria-label={`View ${trainer.full_name}`}>View & manage</Link></td></tr>;
        })}</tbody></table></div>}
        <Pagination path="/admin/trainers" count={result.data.count} filters={filters} />
      </section>
    </>}
  </>;
}
