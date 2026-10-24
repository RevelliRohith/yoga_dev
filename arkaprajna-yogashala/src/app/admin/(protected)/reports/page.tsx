import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { ManagementHeading } from "../management-ui";
import { loadStudio } from "@/lib/studio/admin-data";
import { loadEnrollmentReport } from "@/lib/admin/enrollment-report";
export default async function Reports() {
  await requireAdmin();
  const [{ data, error }, enrollment] = await Promise.all([loadStudio("reports"), loadEnrollmentReport()]);
  return (
    <>
      <ManagementHeading
        title="Clarity for the decisions ahead."
        description="Administrator-only operational reports and exports. Missing data is never represented as zero."
      />
      <section className="management-panel studio-card">
        <h2>Enrollment & teaching</h2>
        {enrollment.error && <p className="admin-notice" role="status">{enrollment.error}</p>}
        {enrollment.data && <>
          <p>{enrollment.data.active} active students · {enrollment.data.inactive} inactive students</p>
          {([['Students by program', enrollment.data.programs], ['Students by batch', enrollment.data.batches]] as const).map(([title, rows]) => (
            <div key={title} className="management-table-wrap">
              <table className="management-table">
                <caption>{title}</caption>
                <thead><tr><th scope="col">Name</th><th scope="col">Active</th><th scope="col">Inactive</th><th scope="col">Trainer</th></tr></thead>
                <tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.active}</td><td>{row.inactive}</td><td>{'trainer' in row ? row.trainer : '—'}</td></tr>)}</tbody>
              </table>
            </div>
          ))}
          <p><Link href="/admin/reports/enrollment/export" prefetch={false}>Enrollment and trainer assignments CSV</Link></p>
        </>}
        <p>
          <Link href="/admin/students">
            Student search, enrollment and status reports
          </Link>
        </p>
        <p>
          <Link href="/admin/students/export" prefetch={false}>
            Student directory CSV (no private contacts)
          </Link>
        </p>
        <p>
          <Link href="/admin/trainers">
            Trainer status and batch assignments
          </Link>
        </p>
        <p>
          <Link href="/admin/batches">Program and batch schedule</Link>
        </p>
      </section>
      <section className="management-panel studio-card">
        <h2>Financial reporting</h2>
        <p>
          <Link href="/admin/fees">
            Daily/monthly collections, payment methods, dues, concessions and
            reversals
          </Link>
        </p>
        <p>
          Financial exports remain unavailable until the approved financial
          schema and read access are activated.
        </p>
      </section>
      <section className="management-panel studio-card">
        <h2>Studio operations</h2>
        {error && <p className="admin-notice">{error}</p>}
        {data && (
          <>
            <p>
              {data.inquiries.length} inquiries,{" "}
              {data.events.filter((e) => e.published).length} published events,{" "}
              {data.certificates.length} issued certificates.
            </p>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Inquiry outcome</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {["new", "contacted", "converted", "closed"].map((status) => (
                    <tr key={status}>
                      <td>{status}</td>
                      <td>
                        {
                          data.inquiries.filter((i) => i.status === status)
                            .length
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Exports omit inquiry contacts, messages and private follow-up
              notes.
            </p>
            <div className="management-actions">
              {["inquiries", "events", "certificates"].map((report) => (
                <Link
                  key={report}
                  href={`/admin/reports/export?report=${report}`}
                  prefetch={false}
                >
                  {report} CSV
                </Link>
              ))}
            </div>
          </>
        )}
        <p>
          <Link href="/admin/inquiries">
            Inquiry outcomes and follow-up history
          </Link>
        </p>
        <p>
          <Link href="/admin/events">Event visibility and schedule</Link>
        </p>
        <p>
          <Link href="/admin/certificates">Issued certificate history</Link>
        </p>
      </section>
    </>
  );
}
