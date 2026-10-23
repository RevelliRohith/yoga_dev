import { requireAdmin } from "@/lib/supabase/admin";
import { loadStudio } from "@/lib/studio/admin-data";
import { csvCell } from "@/lib/admin/students";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  await requireAdmin();
  const report = new URL(request.url).searchParams.get("report");
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!["inquiries", "events", "certificates"].includes(report || ""))
    return new Response("Choose an available report.", {
      status: 400,
      headers,
    });
  const { data, error } = await loadStudio("reports");
  if (!data) return new Response(error, { status: 503, headers });
  let rows: unknown[][];
  if (report === "inquiries") {
    const counts = new Map<string, number>();
    for (const row of data.inquiries) {
      const key = JSON.stringify([row.program, row.status]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    rows = [
      ["program", "status", "count"],
      ...[...counts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, count]) => [...JSON.parse(key), count]),
    ];
  } else if (report === "events") {
    rows = [
      ["title", "starts_at", "venue", "visibility"],
      ...data.events.map((e) => [
        e.title,
        e.starts_at,
        e.venue,
        e.published ? "published" : "draft",
      ]),
    ];
  } else {
    rows = [
      ["reference", "participant_name", "title", "issue_date"],
      ...data.certificates.map((c) => [
        c.reference,
        c.participant_name,
        c.title,
        c.issue_date,
      ]),
    ];
  }
  const csv =
    "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      ...headers,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arkaprajna-${report}.csv"`,
    },
  });
}
