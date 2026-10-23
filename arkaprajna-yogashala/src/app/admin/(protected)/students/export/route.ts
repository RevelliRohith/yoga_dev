import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { filteredStudents } from "@/lib/admin/student-data";
import { studentFilters, csvCell } from "@/lib/admin/students";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  await requireAdmin();
  const filters = studentFilters(Object.fromEntries(new URL(request.url).searchParams));
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  try {
    const db = await createClient();
    const columns = ["student_code", "full_name", "program_id", "batch_id", "joining_date", "status"];
    const rows: Record<string, unknown>[] = [];
    for (;;) {
      const result = await filteredStudents(db, filters, columns.join(",")).range(rows.length, rows.length + 499);
      if (result.error || result.count === null || !result.data) throw new Error("Export unavailable");
      if (!result.data.length) { if (rows.length < result.count) throw new Error("Incomplete export"); break; }
      rows.push(...result.data as unknown as Record<string, unknown>[]);
      if (rows.length > 10000) throw new Error("Export exceeds studio limits");
      if (rows.length >= result.count) break;
    }
    const csv = "\uFEFF" + [columns.map(csvCell).join(","), ...rows.map(row => columns.map(key => csvCell(row[key])).join(","))].join("\r\n");
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="arkaprajna-students.csv"' } });
  } catch { return new Response("Export could not be completed. Please try again.", { status: 503, headers }); }
}
