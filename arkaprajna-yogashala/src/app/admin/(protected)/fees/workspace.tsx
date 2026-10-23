"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { feeCommand } from "./actions";
import { inr, sumPaise, type FeeData } from "@/lib/fees/policy";
import { indianToday } from "@/lib/admin/students";
type StudentChoice = {
  id: string;
  full_name: string;
  student_code: string;
  program_id: string | null;
};
function Command({
  kind,
  enabled,
  children,
}: {
  kind: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(feeCommand, {
    error: "",
    message: "",
  });
  return (
    <form action={action} className="management-editor" aria-busy={pending}>
      <input type="hidden" name="kind" value={kind} />
      {state.error && (
        <p role="alert" className="admin-alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="admin-notice">
          {state.message}
        </p>
      )}
      <fieldset disabled={!enabled || pending}>
        {state.token ? (
          <>
            <input type="hidden" name="stage" value="confirm" />
            <input type="hidden" name="token" value={state.token} />
            <h3>Review before confirming</h3>
            <p className="fee-preview">{state.preview}</p>
            <label>
              <input type="checkbox" name="confirm" required /> I reviewed the
              records, amounts and consequences.
            </label>
            <div className="management-form-actions">
              <button
                type="button"
                className="admin-logout"
                onClick={() => window.location.reload()}
              >
                Cancel / fresh preview
              </button>
              <button className="admin-button">
                {pending ? "Confirming..." : "Confirm operation"}
              </button>
            </div>
          </>
        ) : (
          <>
            {children}
            <button className="admin-button">
              {pending ? "Preparing..." : "Preview operation"}
            </button>
          </>
        )}
      </fieldset>
    </form>
  );
}
export function FeeWorkspace({
  data,
  students,
  enabled,
}: {
  data: FeeData;
  students: StudentChoice[];
  enabled: boolean;
}) {
  const [tab, setTab] = useState("ledger"),
    [q, setQ] = useState(""),
    [month, setMonth] = useState(""),
    [status, setStatus] = useState("all"),
    [student, setStudent] = useState(""),
    [program, setProgram] = useState("");
  const bills = new Map(data.bills.map((b) => [b.id, b]));
  const choices = students.length
    ? students
    : data.bills
        .map((b) => ({
          id: b.student_id,
          full_name: b.student_name_snapshot,
          student_code: b.student_code_snapshot,
          program_id: b.source_program_id,
        }))
        .filter((s, i, a) => a.findIndex((x) => x.id === s.id) === i);
  const selectStudent = (
    <div className="management-field">
      <label htmlFor="fee-student">Student</label>
      <select
        id="fee-student"
        name="student"
        required
        value={student}
        onChange={(e) => setStudent(e.target.value)}
      >
        <option value="">Choose student</option>
        {choices.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name} ✳ {s.student_code}
          </option>
        ))}
      </select>
    </div>
  );
  const billChoice = (
    <div className="management-field">
      <label htmlFor="fee-bill">Bill</label>
      <select id="fee-bill" name="bill" required>
        <option value="">Choose bill</option>
        {data.balances.map((b) => (
          <option key={b.id} value={b.id}>
            {bills.get(b.id)?.student_name_snapshot} ✳{" "}
            {b.billing_month.slice(0, 7)} · due {inr(b.outstanding_paise)}
          </option>
        ))}
      </select>
    </div>
  );
  const paymentChoice = (
    <div className="management-field">
      <label htmlFor="fee-payment">Original receipt</label>
      <select id="fee-payment" name="payment">
        <option value="">Choose payment</option>
        {data.payments
          .filter((p) => !p.reversed_at)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.receipt_number} ✳ {p.student_name_snapshot} ✳{" "}
              {inr(p.amount_paise)}
            </option>
          ))}
      </select>
    </div>
  );
  const amount = (
    <div className="management-field">
      <label htmlFor="fee-amount">Amount (INR)</label>
      <input
        id="fee-amount"
        name="amount"
        inputMode="decimal"
        pattern="[0-9]+(\.[0-9]{1,2})?"
        required
        maxLength={12}
      />
    </div>
  );
  const reason = (
    <div className="management-field">
      <label htmlFor="fee-reason">Reason</label>
      <textarea
        id="fee-reason"
        name="reason"
        required
        minLength={3}
        maxLength={1000}
      />
    </div>
  );
  const reference = (
    <div className="management-field">
      <label htmlFor="fee-reference">
        Source / transaction / refund reference
      </label>
      <input id="fee-reference" name="reference" maxLength={200} />
    </div>
  );
  const collected = data.payments.filter((p) => !p.reversed_at),
    today = indianToday();
  const totals = [
    ["Total billed", sumPaise(data.balances.map((b) => b.due_paise))],
    ["Net collected", sumPaise(collected.map((p) => p.amount_paise))],
    ["Outstanding", sumPaise(data.balances.map((b) => b.outstanding_paise))],
    [
      "Overdue",
      sumPaise(
        data.balances.filter((b) => b.overdue).map((b) => b.outstanding_paise),
      ),
    ],
    [
      "Current month collected",
      sumPaise(
        collected
          .filter((p) => p.received_on.slice(0, 7) === today.slice(0, 7))
          .map((p) => p.amount_paise),
      ),
    ],
  ] as const;
  const filtered = data.balances.filter((b) => {
    const row = bills.get(b.id);
    return (
      (!month || b.billing_month.startsWith(month)) &&
      (!program || row?.source_program_id === program) &&
      (status === "all" ||
        (status === "overdue" ? b.overdue : b.payment_status === status)) &&
      `${row?.student_name_snapshot} ${row?.student_code_snapshot}`
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  });
  return (
    <>
      <section className="student-stats fee-stats">
        {totals.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{inr(value)}</strong>
          </article>
        ))}
      </section>
      <nav className="fee-tabs" aria-label="Fee workspace">
        {[
          "ledger",
          "billing",
          "collection",
          "concession",
          "reversal",
          "reports",
          "reminders",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "admin-button" : "admin-logout"}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
          >
            {t}
          </button>
        ))}
      </nav>
      {!enabled && (
        <p className="admin-alert">
          Read-only workspace. Financial operations require separate activation
          approval.
        </p>
      )}
      {tab === "ledger" && (
        <section className="management-panel">
          <div className="management-filters">
            <label>
              Student name or code
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <label>
              Month
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <label>
              Program
              <select
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              >
                <option value="">All programs</option>
                {[
                  ...new Set(
                    data.bills.map((b) => b.source_program_id).filter(Boolean),
                  ),
                ].map((p) => (
                  <option key={p} value={p!}>
                    {data.bills.find((b) => b.source_program_id === p)
                      ?.program_name_snapshot || "Previous program"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["all", "paid", "partially_paid", "unpaid", "overdue"].map(
                  (s) => (
                    <option key={s}>{s}</option>
                  ),
                )}
              </select>
            </label>
            <button
              className="admin-logout"
              onClick={() => {
                setQ("");
                setMonth("");
                setProgram("");
                setStatus("all");
              }}
            >
              Reset
            </button>
          </div>
          <div className="management-table-wrap">
            <table className="management-table">
              <caption>Monthly fee ledger</caption>
              <thead>
                <tr>
                  {[
                    "Student",
                    "Month",
                    "Due",
                    "Paid",
                    "Outstanding",
                    "Status",
                  ].map((s) => (
                    <th key={s}>{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/admin/fees/students/${b.student_id}`}>
                        {bills.get(b.id)?.student_name_snapshot}
                      </Link>
                      <small>{bills.get(b.id)?.student_code_snapshot}</small>
                    </td>
                    <td>{b.billing_month.slice(0, 7)}</td>
                    <td>{inr(b.due_paise)}</td>
                    <td>{inr(b.paid_paise)}</td>
                    <td>{inr(b.outstanding_paise)}</td>
                    <td>
                      {b.payment_status.replaceAll("_", " ")}
                      {b.overdue && <small>Overdue</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <p className="management-empty">No bills match this view.</p>
            )}
          </div>
          <h2>Recent receipts</h2>
          {[...data.payments]
            .sort((a, b) => b.received_on.localeCompare(a.received_on))
            .slice(0, 10)
            .map((p) => (
              <p key={p.id}>
                <Link href={`/admin/fees/receipts/${p.id}`}>
                  {p.receipt_number}
                </Link>{" "}
                ✳ {p.student_name_snapshot} ✳ {inr(p.amount_paise)}{" "}
                {p.reversed_at && " · REVERSED"}
              </p>
            ))}
        </section>
      )}
      {tab === "billing" && (
        <Command kind="bill" enabled={enabled}>
          <h2>Preview a monthly bill</h2>
          {selectStudent}
          <div className="management-form-grid">
            <label>
              Billing month
              <input
                type="month"
                name="month"
                required
                defaultValue={today.slice(0, 7)}
              />
            </label>
            <label>
              Source
              <select name="source">
                <option value="program">Current program rate</option>
                <option value="opening">
                  Explicit historical opening balance
                </option>
              </select>
            </label>
          </div>
          <p>
            Normal bills use the enrolled program&rsquo;s full current monthly
            fee. Opening bills use the explicitly entered historic balance.
          </p>
          <label>
            Opening balance amount (INR, opening bills only)
            <input name="amount" inputMode="decimal" maxLength={12} />
          </label>
          {reference}
          <label>
            Fixed concession (INR)
            <input name="concession" defaultValue="0" inputMode="decimal" />
          </label>
          <label>
            Concession reason
            <textarea name="reason" maxLength={1000} />
          </label>
          <label>
            Enrollment exception reason
            <textarea name="exception" maxLength={1000} />
          </label>
        </Command>
      )}
      {tab === "collection" && (
        <Command kind="payment" enabled={enabled}>
          <h2>Record a verified offline payment</h2>
          {selectStudent}
          {amount}
          <div className="management-form-grid">
            <label>
              Received date
              <input
                name="date"
                type="date"
                required
                defaultValue={today}
                max={today}
              />
            </label>
            <label>
              Method
              <select name="method">
                <option value="cash">Cash</option>
                <option value="upi">Administrator-verified UPI</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </label>
          </div>
          {reference}
          <label>
            Notes
            <textarea name="note" maxLength={2000} />
          </label>
          <h3>Explicit allocation by month</h3>
          {data.balances
            .filter((b) => b.student_id === student && b.outstanding_paise > 0)
            .map((b) => (
              <label key={b.id}>
                {b.billing_month.slice(0, 7)} · Outstanding{" "}
                {inr(b.outstanding_paise)}
                <input
                  name={`allocation_${b.id}`}
                  inputMode="decimal"
                  placeholder="Allocation in INR"
                />
              </label>
            ))}
          <label>
            <input name="verified" type="checkbox" required /> I independently
            verified receipt and checked for duplicates. A screenshot or entered
            reference is not proof.
          </label>
        </Command>
      )}
      {tab === "concession" && (
        <Command kind="concession" enabled={enabled}>
          <h2>Adjust a fixed concession</h2>
          {billChoice}
          {amount}
          {reason}
        </Command>
      )}
      {tab === "reversal" && (
        <Command kind="reversal" enabled={enabled}>
          <h2>Full payment reversal</h2>
          <p>
            Preserve the original receipt and reopen its allocated balances.
            Partial refunds are unsupported.
          </p>
          {paymentChoice}
          <label>
            Kind
            <select name="reversal_kind">
              <option value="entry_correction">Audited entry correction</option>
              <option value="verified_refund">
                Separately verified full manual refund
              </option>
            </select>
          </label>
          {reason}
          {reference}
          <label>
            <input type="checkbox" name="verified" /> Refund disbursement was
            separately approved and verified.
          </label>
        </Command>
      )}
      {tab === "reports" && (
        <section className="management-panel fee-report">
          <h2>Collections & dues</h2>
          <p>
            Collections exclude reversed payments. These are live operational
            reports, not an accounting-period close.
          </p>
          {[
            "payments",
            "outstanding",
            "overdue",
            "concessions",
            "reversals",
            "daily",
            "monthly",
            "methods",
          ].map((r) => (
            <p key={r}>
              <a href={`/admin/fees/export?report=${r}`}>Export {r} CSV</a>
            </p>
          ))}
          <details className="studio-card">
            <summary>Recorded audit history</summary>
            <div className="management-table-wrap">
              <table className="management-table">
                <thead>
                  <tr>
                    <th>Recorded (India)</th>
                    <th>Action</th>
                    <th>Administrator reference</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.events]
                    .sort((a, b) => b.created_at.localeCompare(a.created_at))
                    .slice(0, 100)
                    .map((e) => (
                      <tr key={e.id}>
                        <td>
                          {new Intl.DateTimeFormat("en-IN", {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: "Asia/Kolkata",
                          }).format(new Date(e.created_at))}
                        </td>
                        <td>{e.action.replaceAll("_", " ")}</td>
                        <td>
                          <code>{e.created_by}</code>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <p>
              Latest 100 events shown. Full immutable records remain in the
              financial audit journal.
            </p>
          </details>
          <h3>Reversals</h3>
          {data.reversals.map((r) => (
            <p key={r.id}>
              {r.created_at.slice(0, 10)} ✳ {r.kind} ✳ {r.reason}
            </p>
          ))}
        </section>
      )}
      {tab === "reminders" && (
        <Command kind="reminder" enabled={enabled}>
          <h2>Prepare a manual reminder</h2>
          <p>
            Upcoming: 8th. Grace: 11th. Overdue: 16th. Prepare and review only;
            nothing is sent.
          </p>
          {billChoice}
          <label>
            Category
            <select name="reminder_kind">
              {["upcoming", "grace", "overdue", "payment_confirmation"].map(
                (s) => (
                  <option key={s}>{s}</option>
                ),
              )}
            </select>
          </label>
          {paymentChoice}
        </Command>
      )}
    </>
  );
}
