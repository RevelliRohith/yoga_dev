import Link from "next/link";
import { PAGE_SIZE, type ProgramOption, type parseFilters } from "@/lib/admin/management";

type Filters = ReturnType<typeof parseFilters>;

export function ManagementHeading({ title, description, action }: {
  title: string; description: string; action?: { href: string; label: string };
}) {
  return <div className="admin-heading management-heading"><div><p className="admin-eyebrow">STUDIO MANAGEMENT</p><h1>{title}</h1><p className="admin-muted">{description}</p></div>
    {action && <Link className="admin-button management-primary" href={action.href}>＋ {action.label}</Link>}
  </div>;
}

export function LoadError({ message, href }: { message: string; href: string }) {
  return <section className="management-empty" role="alert"><h2>We couldn’t load this space.</h2><p>{message}</p><Link className="admin-logout" href={href}>Try again</Link></section>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span className={`management-status ${active ? "is-active" : "is-inactive"}`}><span aria-hidden="true">●</span>{active ? "Active" : "Inactive"}</span>;
}

export function SummaryCards({ noun, total, active }: { noun: string; total: number | null; active: number | null }) {
  return <section className="management-summary" aria-label={`${noun} summary`}>
    <article><span>Total {noun.toLowerCase()}</span><strong>{total ?? "Unavailable"}</strong><small>All studio records</small></article>
    <article><span>Active {noun.toLowerCase()}</span><strong>{active ?? "Unavailable"}</strong><small>Currently available</small></article>
  </section>;
}

export function SaveNotice({ notice, noun }: { notice?: string; noun: string }) {
  if (notice !== "created" && notice !== "updated") return null;
  return <p className="admin-notice" role="status">{noun} {notice === "created" ? "created" : "updated"} successfully.</p>;
}

export function SearchFilters({ path, filters, programs }: { path: string; filters: Filters; programs?: ProgramOption[] }) {
  return <form action={path} method="get" className="management-filters" role="search">
    <div className="management-search"><label htmlFor="management-search">Search by name</label><input id="management-search" type="search" name="q" defaultValue={filters.q} placeholder="Find a name…" maxLength={120} /></div>
    <div><label htmlFor="management-status">Status</label><select id="management-status" name="status" defaultValue={filters.status}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
    {programs && <div><label htmlFor="management-program">Yoga program</label><select id="management-program" name="program" defaultValue={filters.program}><option value="">All programs</option>{programs.map(program => <option key={program.id} value={program.id}>{program.name}{!program.is_active ? " (inactive)" : ""}</option>)}</select></div>}
    <button className="admin-logout">Apply filters</button><Link className="management-text-link" href={path}>Reset</Link>
  </form>;
}

export function Pagination({ path, count, filters }: { path: string; count: number | null; filters: Filters }) {
  const url = (page: number) => {
    const params = new URLSearchParams({ page: String(page) });
    if (filters.q) params.set("q", filters.q);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.program) params.set("program", filters.program);
    return `${path}?${params}`;
  };
  return <nav className="management-pagination" aria-label="List pagination"><span>{count === null ? "Count unavailable" : `${count} matching ${count === 1 ? "record" : "records"}`} · Page {filters.page}</span><div>
    {filters.page > 1 && <Link href={url(filters.page - 1)} className="admin-logout">← Previous</Link>}
    {count !== null && count > filters.page * PAGE_SIZE && <Link href={url(filters.page + 1)} className="admin-logout">Next →</Link>}
  </div></nav>;
}

export function EmptyList({ filtered, noun, href }: { filtered: boolean; noun: string; href: string }) {
  return <div className="management-empty"><span aria-hidden="true">✳</span><h2>{filtered ? `No ${noun} match these filters.` : `Your ${noun} begin here.`}</h2><p>{filtered ? "Try another name or clear your filters." : `Create your first record to start shaping your studio schedule.`}</p><Link className="management-text-link" href={href}>{filtered ? "Clear filters" : `Create ${noun === "programs" ? "a program" : "a batch"}`} →</Link></div>;
}
