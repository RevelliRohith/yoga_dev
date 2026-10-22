import Link from "next/link";
import { loadPrograms } from "@/lib/admin/data";
import { formatFee, parseFilters, type SearchValues } from "@/lib/admin/management";
import { EmptyList, LoadError, ManagementHeading, Pagination, SaveNotice, SearchFilters, StatusBadge, SummaryCards } from "../management-ui";

export const metadata = { title: "Yoga Programs" };

export default async function ProgramsPage({ searchParams }: { searchParams: Promise<SearchValues & { notice?: string }> }) {
  const search = await searchParams;
  const filters = parseFilters(search);
  const result = await loadPrograms(filters);
  return <>
    <ManagementHeading title="Yoga programs." description="Thoughtful offerings for every stage of practice." action={{ href: "/admin/programs/new", label: "New program" }} />
    {!result.data ? <LoadError message={result.error} href="/admin/programs" /> : <>
      <SaveNotice notice={search.notice} noun="Program" />
      <SummaryCards noun="Programs" total={result.data.total} active={result.data.active} />
      <section className="management-panel" aria-label="Yoga programs"><SearchFilters path="/admin/programs" filters={filters} />
        {result.data.records.length === 0 ? <EmptyList filtered={!!filters.q || filters.status !== "all" || filters.page > 1} noun="programs" href={filters.q || filters.status !== "all" || filters.page > 1 ? "/admin/programs" : "/admin/programs/new"} /> : <div className="management-table-wrap" role="region" aria-label="Programs table" tabIndex={0}><table className="management-table"><caption className="management-sr-only">Yoga program details</caption><thead><tr><th scope="col">Program</th><th scope="col">Monthly fee</th><th scope="col">Status</th><th scope="col"><span className="management-sr-only">Actions</span></th></tr></thead><tbody>{result.data.records.map(program => <tr key={program.id}><th scope="row"><Link href={`/admin/programs/${program.id}/edit`}>{program.name}</Link><p className="management-description">{program.description || "No description added."}</p></th><td><strong>{formatFee(program.monthly_fee)}</strong><small>per month</small></td><td><StatusBadge active={program.is_active} /></td><td><Link href={`/admin/programs/${program.id}/edit`} className="admin-logout" aria-label={`Edit ${program.name}`}>Edit ↗</Link></td></tr>)}</tbody></table></div>}
        <Pagination path="/admin/programs" count={result.data.count} filters={filters} />
      </section>
    </>}
  </>;
}
