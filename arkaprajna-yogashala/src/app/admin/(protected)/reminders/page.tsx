import Link from "next/link";
import { loadFees } from "@/lib/fees/data";
import { loadStudio, operationsWrite } from "@/lib/studio/admin-data";
import { inr } from "@/lib/fees/policy";
import { indianToday } from "@/lib/admin/students";
import { ManagementHeading } from "../management-ui";
import { ReminderCard } from "./reminder-card";
import { loadReminderHistory } from "@/lib/studio/reminders";
export default async function Reminders() {
  const [f, s] = await Promise.all([loadFees(), loadStudio("communications")]);
  const history = await loadReminderHistory();
  const tracking = (id: string) => ({ id, handled: history.records.find(r => r.id === id)?.handled || false, enabled: !history.error && operationsWrite() });
  const today = indianToday(),
    day = Number(today.slice(8));
  return (
    <>
      <ManagementHeading
        title="A considerate follow-up."
        description="Review and copy messages manually. Nothing is sent automatically."
      />
      {history.error && <p className="admin-alert">{history.error}</p>}
      <section className="management-panel studio-card">
        <h2>Fee reminders</h2>
        {f.error && <p>{f.error}</p>}
        {f.data?.balances
          .filter(
            (b) =>
              b.outstanding_paise > 0 &&
              (day === 8 || day === 11
                ? b.billing_month.slice(0, 7) === today.slice(0, 7)
                : day === 16 && b.overdue),
          )
          .map((b) => {
            const bill = f.data!.bills.find((x) => x.id === b.id);
            return (
              <ReminderCard
                {...tracking(`fee:${b.id}:${today}`)}
                key={b.id}
                text={`Hello ${bill?.student_name_snapshot}, a friendly ${day === 8 ? "upcoming fee" : day === 11 ? "grace-period" : "overdue balance"} reminder for ${b.billing_month.slice(0, 7)}. Outstanding: ${inr(b.outstanding_paise)}. Please contact the studio to review or arrange payment. No late fee applies.`}
              />
            );
          })}
        {![8, 11, 16].includes(day) && (
          <p>The approved fee reminder dates are the 8th, 11th and 16th.</p>
        )}
        <Link href="/admin/fees">Fee journal and payment confirmations ·</Link>
      </section>
      <section className="management-panel studio-card">
        <h2>Payment confirmation drafts</h2>
        {f.data?.payments
          .filter((p) => !p.reversed_at)
          .slice(-10)
          .map((p) => (
            <ReminderCard
              {...tracking(`payment:${p.id}:${p.received_on}`)}
              key={p.id}
              text={`Hello ${p.student_name_snapshot}, the studio has recorded ${inr(p.amount_paise)} by ${p.method} on ${p.received_on}. Receipt ${p.receipt_number}. Allocated months: ${f
                .data!.allocations.filter((a) => a.payment_id === p.id)
                .map((a) =>
                  f
                    .data!.bills.find((b) => b.id === a.bill_id)
                    ?.billing_month.slice(0, 7),
                )
                .join(", ")}. Please contact the studio with any questions.`}
            />
          ))}
        <h2>Inquiry follow-ups</h2>
        {s.error && <p>{s.error}</p>}
        {s.data?.inquiries
          .filter((i) => ["new", "contacted"].includes(i.status))
          .map((i) => (
            <ReminderCard
              {...tracking(`inquiry:${i.id}:${today}`)}
              key={i.id}
              text={`Hello ${i.full_name}, following up on your inquiry${i.program ? ` about ${i.program}` : ""}. Please let the studio know a convenient time to discuss your class preferences.`}
            />
          ))}
      </section>
      <section className="management-panel studio-card">
        <h2>Event announcements</h2>
        {s.data?.events
          .filter((e) => e.published && e.starts_at >= new Date().toISOString())
          .map((e) => (
            <ReminderCard
              {...tracking(`event:${e.id}:${new Date(e.updated_at).toISOString().replaceAll(":", "-")}`)}
              key={e.id}
              text={`${e.title} - ${new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(e.starts_at))} IST, ${e.venue}. Contact the studio for details.`}
            />
          ))}
      </section>
    </>
  );
}
