import { loadEnrollmentReport } from "@/lib/admin/enrollment-report";
import { csvCell } from "@/lib/admin/students";

export const dynamic = "force-dynamic";
export async function GET() {
  const { data, error } = await loadEnrollmentReport();
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (!data) return new Response(error, { status: 503, headers });
  const rows: unknown[][] = [
    ["group", "name", "trainer", "active_students", "inactive_students"],
    ["studio", "All students", "", data.active, data.inactive],
    ...data.programs.map(p => ["program", p.name, "", p.active, p.inactive]),
    ...data.batches.map(b => ["batch", b.name, b.trainer, b.active, b.inactive]),
  ];
  return new Response("\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="arkaprajna-enrollment.csv"' },
  });
}
