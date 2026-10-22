import Link from "next/link";
import { loadBatches } from "@/lib/admin/data";
import { formatDays, formatTime, parseFilters, type SearchValues } from "@/lib/admin/management";
import { EmptyList, LoadError, ManagementHeading, Pagination, SaveNotice, SearchFilters, StatusBadge, SummaryCards } from "../management-ui";

export const metadata = { title: "Batches" };

export default async function BatchesPage({ searchParams }: { searchParams: Promise<SearchValues & { notice?: string }> }) {
  const search = await searchParams;
  const filters = parseFilters(search);
  const result = await loadBatches(filters);
  const programNames = new Map(result.data?.programs.map(program => [program.id, program]));
  const trainerNames = new Map(result.data?.trainers.map(trainer => [trainer.id, trainer.full_name?.trim() || `Trainer ${trainer.id.slice(0, 8)}`]));
  const filtered = !!filters.q || filters.status !== "all" || !!filters.program || filters.page > 1;
  return <>
    <ManagementHeading title="Your studio’s rhythm." description="Bring your programs to life with a clear weekly schedule." action={{ href: "/admin/batches/new", label: "New batch" }} />
    {!result.data ? <LoadError message={result.error} href="/admin/batches" /> : <>
      <SaveNotice notice={search.notice} noun="Batch" />
      <SummaryCards noun="Batches" total={result.data.total} active={result.data.active} />
      <section className="management-panel" aria-label="Batches"><SearchFilters path="/admin/batches" filters={filters} programs={result.data.programs} />
        {result.data.records.length === 0 ? <EmptyList filtered={filtered} noun="batches" href={filtered ? "/admin/batches" : "/admin/batches/new"} /> : <div className="management-table-wrap" role="region" aria-label="Batches table" tabIndex={0}><table className="management-table"><caption className="management-sr-only">Batch programs, trainers, and schedules</caption><thead><tr><th scope="col">Batch & program</th><th scope="col">Trainer</th><th scope="col">Schedule</th><th scope="col">Status</th><th scope="col"><span className="management-sr-only">Actions</span></th></tr></thead><tbody>{result.data.records.map(batch => <tr key={batch.id}><th scope="row"><Link href={`/admin/batches/${batch.id}/edit`}>{batch.name}</Link><small>{programNames.get(batch.program_id)?.name ?? "Program unavailable"}{programNames.get(batch.program_id)?.is_active === false ? " · inactive program" : ""}</small></th><td>{batch.trainer_id ? trainerNames.get(batch.trainer_id) ?? "Trainer unavailable" : <span className="admin-muted">Unassigned</span>}</td><td><strong>{formatTime(batch.start_time)} – {formatTime(batch.end_time)}</strong><small>{formatDays(batch.days_of_week)}</small></td><td><StatusBadge active={batch.is_active} /></td><td><Link href={`/admin/batches/${batch.id}/edit`} className="admin-logout" aria-label={`Edit ${batch.name}`}>Edit ↗</Link></td></tr>)}</tbody></table></div>}
        <Pagination path="/admin/batches" count={result.data.count} filters={filters} />
      </section>
    </>}
  </>;
}
