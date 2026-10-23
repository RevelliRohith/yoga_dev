import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/management";
import { loadFees } from "@/lib/fees/data";
import { inr } from "@/lib/fees/policy";
import { PrintButton } from "@/components/print-button";
import { publicContent } from "@/lib/studio/public-data";
export default async function Receipt({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await loadFees();
  if (!r.data) return <p className="admin-alert">{r.error}</p>;
  const d = r.data,
    p = d.payments.find((x) => x.id === id);
  if (!p) notFound();
  const content = await publicContent();
  return (
    <>
      <PrintButton />
      <article className="print-document">
        <p className="admin-eyebrow">PAYMENT RECEIPT</p>
        <h1>{content.settings.name}</h1>
        {content.settings.address && <p>{content.settings.address}</p>}
        {content.settings.phone && <p>{content.settings.phone}</p>}
        <h2>{p.receipt_number}</h2>
        {p.reversed_at && (
          <strong className="admin-alert">
            REVERSED · original history preserved
          </strong>
        )}
        <dl className="trainer-details">
          {[
            ["Student", p.student_name_snapshot],
            ["Studio code", p.student_code_snapshot],
            ["Received", p.received_on],
            ["Method", p.method],
            ["Amount", inr(p.amount_paise)],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <h3>Explicit month allocations</h3>
        {d.allocations
          .filter((a) => a.payment_id === id)
          .map((a) => (
            <p key={a.bill_id}>
              {d.bills
                .find((b) => b.id === a.bill_id)
                ?.billing_month.slice(0, 7)}{" "}
              ✳ {inr(a.amount_paise)}
            </p>
          ))}
        {d.reversals
          .filter((x) => x.payment_id === id)
          .map((x) => (
            <p key={x.id}>
              Reversal: {x.kind} ✳ {x.reason} ✳ {x.created_at.slice(0, 10)}
            </p>
          ))}
        {content.settings.receipt_footer && (
          <p>{content.settings.receipt_footer}</p>
        )}
      </article>
    </>
  );
}
