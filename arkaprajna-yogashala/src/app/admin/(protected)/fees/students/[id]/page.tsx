import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/management";
import { loadFees } from "@/lib/fees/data";
import { inr } from "@/lib/fees/policy";
export default async function Ledger({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await loadFees();
  if (!r.data) return <p className="admin-alert">{r.error}</p>;
  const d = r.data;
  return (
    <>
      <Link href={`/admin/students/${id}`}>Student profile</Link>
      <h1>Student fee history</h1>
      {d.balances
        .filter((b) => b.student_id === id)
        .map((b) => (
          <section className="management-panel fee-report" key={b.id}>
            <h2>
              {b.billing_month.slice(0, 7)} ✳{" "}
              {d.bills.find((x) => x.id === b.id)?.student_name_snapshot}
            </h2>
            <p>
              Due {inr(b.due_paise)} · Paid {inr(b.paid_paise)} · Outstanding{" "}
              {inr(b.outstanding_paise)} ✳ {b.payment_status}
              {b.overdue ? " ? Overdue" : ""}
            </p>
            <p>
              Concession {inr(b.concession_paise)} ✳{" "}
              {d.bills.find((x) => x.id === b.id)?.concession_reason ||
                "No concession reason"}
            </p>
            {d.allocations
              .filter((a) => a.bill_id === b.id)
              .map((a) => {
                const p = d.payments.find((p) => p.id === a.payment_id);
                return (
                  <p key={a.payment_id}>
                    <Link href={`/admin/fees/receipts/${a.payment_id}`}>
                      {p?.receipt_number}
                    </Link>{" "}
                    · Allocation {inr(a.amount_paise)}{" "}
                    {p?.reversed_at ? " · REVERSED" : ""}
                  </p>
                );
              })}
          </section>
        ))}
      {!d.balances.some((b) => b.student_id === id) && (
        <p>
          No generated bills for this student. No historical debt is assumed.
        </p>
      )}
    </>
  );
}
