import { requireAdmin } from "@/lib/supabase/admin";
import { loadFees } from "@/lib/fees/data";
import { csv, sumPaise } from "@/lib/fees/policy";
export async function GET(request: Request) {
  await requireAdmin();
  const r = await loadFees();
  if (!r.data)
    return new Response("Financial report unavailable.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  const d = r.data,
    kind = new URL(request.url).searchParams.get("report") || "payments";
  let rows: unknown[][] = [];
  if (kind === "payments")
    rows = [
      [
        "Receipt",
        "Student code",
        "Received date",
        "Method",
        "Amount paise",
        "Status",
      ],
      ...d.payments.map((p) => [
        p.receipt_number,
        p.student_code_snapshot,
        p.received_on,
        p.method,
        p.amount_paise,
        p.reversed_at ? "reversed" : "confirmed",
      ]),
    ];
  else if (["outstanding", "overdue", "concessions"].includes(kind))
    rows = [
      [
        "Student code",
        "Month",
        "Due paise",
        "Paid paise",
        "Outstanding paise",
        "Concession paise",
        "Reason",
      ],
      ...d.balances
        .filter((b) =>
          kind === "overdue"
            ? b.overdue
            : kind === "concessions"
              ? b.concession_paise > 0
              : b.outstanding_paise > 0,
        )
        .map((b) => {
          const bill = d.bills.find((x) => x.id === b.id);
          return [
            bill?.student_code_snapshot,
            b.billing_month,
            b.due_paise,
            b.paid_paise,
            b.outstanding_paise,
            b.concession_paise,
            bill?.concession_reason,
          ];
        }),
    ];
  else if (kind === "reversals")
    rows = [
      ["Receipt", "Kind", "Reason", "Recorded at"],
      ...d.reversals.map((r) => [
        d.payments.find((p) => p.id === r.payment_id)?.receipt_number,
        r.kind,
        r.reason,
        r.created_at,
      ]),
    ];
  else if (["daily", "monthly", "methods"].includes(kind)) {
    const groups = new Map<string, number[]>();
    for (const p of d.payments.filter((p) => !p.reversed_at)) {
      const k =
        kind === "methods"
          ? p.method
          : kind === "monthly"
            ? p.received_on.slice(0, 7)
            : p.received_on;
      groups.set(k, [...(groups.get(k) || []), p.amount_paise]);
    }
    rows = [
      ["Period or method", "Net collected paise"],
      ...[...groups]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sumPaise(v)]),
    ];
  } else return new Response("Unknown report.", { status: 400 });
  return new Response("\uFEFF" + csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arkaprajna-${kind}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
