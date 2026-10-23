import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainerDashboard } from "@/lib/trainer/dashboard";
import { isUuid, PAGE_SIZE } from "@/lib/admin/management";
export default async function TrainerRosterPage({ searchParams }: { searchParams: Promise<{ batch?: string; q?: string; page?: string }> }) {
  const result = await loadTrainerDashboard();
  const search = await searchParams;
  const batch = typeof search.batch === "string" ? search.batch : "";
  if (batch && !isUuid(batch)) notFound();
  if (result.data && batch && !result.data.batches.some(b => b.id === batch)) notFound();
  const q = typeof search.q === "string" ? search.q.trim().slice(0, 120) : "";
  const page = typeof search.page === "string" && /^\d{1,6}$/.test(search.page) ? Math.max(1, Number(search.page)) : 1;
  const students = result.data?.students.filter(s => (!batch || s.batch_id === batch) && (!q || `${s.full_name} ${s.student_code}`.toLowerCase().includes(q.toLowerCase()))) ?? [];
  const names = new Map(result.data?.batches.map(b => [b.id, b.name]));
  const pageUrl = (number: number) => `/trainer/roster?${new URLSearchParams({ batch, q, page: String(number) })}`;
  return <><div className="admin-heading"><div><p className="admin-eyebrow">YOUR STUDENTS</p><h1>A community in practice.</h1><p className="admin-muted">Students from your assigned batches. Contact details remain with studio administration.</p></div></div>{!result.data ? <section className="management-empty" role="alert"><p>{result.error}</p><Link href="/trainer/roster" className="admin-logout">Try again</Link></section> : <section className="management-panel"><form action="/trainer/roster" className="management-filters" role="search"><div className="management-search"><label htmlFor="roster-search">Name or student code</label><input id="roster-search" name="q" type="search" maxLength={120} defaultValue={q} /></div><div><label htmlFor="roster-batch">Assigned batch</label><select name="batch" id="roster-batch" defaultValue={batch}><option value="">All assigned batches</option>{result.data.batches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div><button className="admin-logout">Apply</button><Link href="/trainer/roster" className="management-text-link">Reset</Link></form>
    {!students.length ? <div className="management-empty"><h2>No students in this view.</h2><p>Try another filter, or ask your administrator about your batch assignments.</p></div> : <div className="management-table-wrap" role="region" aria-label="Assigned student roster" tabIndex={0}><table className="management-table"><caption className="management-sr-only">Student name, code, assigned batch and status</caption><thead><tr><th scope="col">Student</th><th scope="col">Code</th><th scope="col">Batch</th><th scope="col">Status</th></tr></thead><tbody>{students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(s => <tr key={s.id}><th scope="row">{s.full_name}</th><td>{s.student_code}</td><td>{names.get(s.batch_id)}</td><td>{s.status === "active" ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}
    <nav className="management-pagination" aria-label="Roster pagination"><span>{students.length} matching students · Page {page}</span><div>{page > 1 && <Link href={pageUrl(page - 1)} className="admin-logout">Previous</Link>}{page * PAGE_SIZE < students.length && <Link href={pageUrl(page + 1)} className="admin-logout">Next</Link>}</div></nav>
  </section>}</>;
}
