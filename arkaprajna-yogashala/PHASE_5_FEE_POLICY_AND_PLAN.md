# Phase 5 - Confirmed fee policy and implementation review

Status: all seven business policies and both zero-fee/reversal conventions are approved. The actual public inventory and fresh user-supplied metadata were reviewed. The corrected financial migration passed 38 isolated test groups and remains unchanged; it has NOT been applied to production. Fee UI/server integration is implemented behind disabled read/write switches and covered by new mock/unit checks. Fresh alternate API-surface evidence, explicit production migration approval and hosted integration/activation remain pending. See PHASE_5_PRODUCTION_READINESS.md and MASTER_CONTINUATION_REPORT.md. No real financial activity or credential setup is authorized by policy approval.

## Confirmed policy

- Calendar-month billing, first through last day. Due date: the 10th. Grace: the 11th through the 15th. An outstanding balance becomes overdue on the 16th, without a late penalty.
- New admissions pay the full first calendar month's fee regardless of joining day; no first-month proration.
- Partial payments and advances are allowed. Multiple payments can settle one monthly bill. Administrators explicitly select billing months and allocation amounts; no automatic reallocation is approved.
- Base payment status: Unpaid when no payment is received, Partially Paid when some is received and a balance remains, Paid when fully settled. Overdue is independent: an unpaid or partially paid month is overdue on/after its 16th. A settled month is never overdue.
- No late fees and no automatic student deactivation for unpaid fees.
- Cash, UPI and bank transfer are supported offline methods. Administrators must verify receipt before recording. A screenshot, entered reference or launched UPI application is not payment confirmation.
- Razorpay availability is unconfirmed. No live gateway, credentials or transactions are authorized. Preserve a future gateway integration boundary rather than wiring a fake success flow.
- Confirmed payments require duplicate protection, unique receipt numbers, payment history and audit records. Never lose an excess amount or silently move it to another month.
- Reminder categories: upcoming due date, grace, overdue and payment confirmation. No email, WhatsApp or other external sending is authorized by this policy.

Use the application's existing India date convention consistently for billing-date boundaries and tests; timestamps should remain stored as UTC instants and billing periods/due dates as calendar dates. Boundary behavior must be tested around midnight in the studio timezone, not inferred from the server timezone.

## Existing implementation inspected

The actual Desktop export `phase_5_schema_inventory.txt.txt` has now been extracted and validated as schema_inventory, not security_snapshot. Its ignored normalized copy is `supabase/review/baselines/phase_5_schema_inventory.json`. Capture: 2026-10-22T14:59:27Z; postgres; expected project label ogzdhmptzeyinhgxcgii. It contains four public tables, 41 columns, ten policies, four functions and 14 validated constraints. No financial tables exist in this captured public inventory. Other schemas, current function bodies, ACLs, indexes and triggers are outside its scope; the fresh read-only security capture closes those gaps before execution approval.

Existing profiles, programs, batches and students are reused. Existing table columns, policies and common function/constraint metadata agree with the saved Stage 3B after snapshot after presentation-escape normalization. Existing role helpers, trainer RPCs and student privacy restrictions must remain unchanged. See PHASE_5_DATABASE_REVIEW.md for the five-table financial proposal, verification, recovery and outstanding validation gates. No SQL has been executed.

## Approved business decisions

| Decision | Approved option |
| --- | --- |
| Advance allocation | Administrator explicitly selects billing months and amounts. Future-month bills must be explicitly previewed/generated first. No automatic oldest-debt allocation, automatic credit transfer or unallocated excess. Allocation totals must equal the recorded payment amount; otherwise stop for explicit allocation. |
| Discounts/concessions | Fixed rupee concessions only initially, entered by an administrator with a required reason, limited to the bill's amount. Defer percentage rules until needed. Do not permit a negative bill. |
| Incorrect entries/reversals/refunds | Never edit/delete a confirmed payment. Use an administrator-confirmed, reasoned reversal/correction linked to the original, retaining actor/time and receipt history. Actual refund disbursement is separately approved and manually verified; recording a correction must not pretend funds were transferred. |
| Opening historical balances | Explicitly reviewed opening bills per student and billing month, with source/reference and an import preview. Do not infer historic debt from current program fees or bulk-create old months automatically. |
| Program fee changes | Snapshot the approved amount on each generated bill. New rates affect bills generated afterward; existing bills, including future bills already generated or unpaid bills, stay unchanged unless a separately approved audited adjustment is made. |
| Monthly bill generation | Administrator-controlled monthly preview and confirmation; no automatic job initially. Enforce one bill per student/calendar month and make generation idempotent. |
| Reminder schedule | Manual review queue initially: upcoming on the 8th, grace on the 11th, overdue on the 16th; payment confirmation available after verified recording. No automatic external sending and no repeated reminders without review/history. |

Razorpay remains gated regardless of approval of these recommendations. No credential request is necessary for offline development.

Generation preview must also flag inactive students, missing program/fee source, future admissions, and mid-month program changes. The operator must explicitly choose the applicable student/month/amount rather than silently guessing eligibility or repricing an enrollment. If automatic treatment of these cases is wanted, obtain an additional clear rule first. The approved zero-fee convention is Paid with zero outstanding and no payment receipt.

The approved reversal convention reduces net settled amount and reopens that bill's outstanding balance; any replacement payment or verified refund is a separate explicit event. Original payment and receipt records remain identifiable and visibly reversed, not deleted or reused. Actual financial mutations and refunds still require separate approval.

## Proposed implementation sequence after decisions/schema review

1. Inspect the schema inventory. Reuse any existing bills/payments/allocations/receipt/audit structures. If storage is missing, propose only the minimum needed; do not execute a migration. Include constraints, indexes, admin-only RLS, effective grants, function authorization, verification queries and a non-destructive recovery plan.
2. Implement and unit-test confirmed policy primitives: exact INR arithmetic in paise, calendar-month boundaries, due/grace/overdue conditions, payment-status derivation and full first-month fees. No binary floating-point balance arithmetic and no invented penalty/deactivation rules.
3. Build an admin-only fee overview and student monthly history with honest unavailable/error states until the reviewed schema is applied. Explicit generation preview and approved concessions/adjustments follow only the chosen policies.
4. Implement verified offline collection with student/month allocation preview, required method/date, applicable transaction reference and administrator confirmation. The client cannot select a successful gateway status or bypass verification.
5. Record payment, allocations, unique receipt identity and audit event atomically on the database server. Use an idempotency key with a uniqueness constraint and stable row locking/order so retries/concurrent requests cannot double-collect or exceed the selected bills' remaining balance. Do not rely on a client-side disabled button or an application read-then-write balance check.
6. Compute Paid/Partially Paid/Unpaid and a separate overdue flag from bills and net confirmed allocations, honoring the approved reversal rule. Financial state must never depend on opening an app or user-entered proof.
7. Add filtered reports/CSV and a narrow future gateway adapter. Any gateway order creation, verified signature/webhook processing, payment capture/refunds and live credentials remain separately gated.
8. Add receipts/reminder UI in Phase 6 after the payment/receipt identity is verified. Prepare content for review; do not send external messages implicitly.

Database transaction checks must independently verify auth.uid() has admin role. Any SECURITY DEFINER RPC needs qualified references, safe search_path and restricted EXECUTE grants. New financial tables must have no trainer/anonymous read path, including views, joins, GraphQL or RPCs. Do not extend the trainer's six-field roster with financial columns.

## Verification plan

- Due-date boundaries: the 10th, 11th, 15th and 16th; previous/future months and leap February, using the studio date convention.
- Partial and full settlement; a partially paid bill can be overdue, but a paid bill cannot. Zero fee convention only after approval.
- Mid/late-month admission remains full first-month fee; no early-year/month arithmetic mistakes or hidden proration.
- Multiple payments, approved future allocations and rejection of unallocated excess; no silent cross-month transfer.
- Duplicate request retries and two concurrent payments against the same balance; atomic all-or-nothing allocation, unique receipts and audit identities.
- Approved concession limits, historical import previews, immutable rate snapshots and audited reversals/refunds once their policies are approved.
- Admin-only reads/actions/export; denied anonymous/trainer financial access; original trainer privacy and Programs/Batches/Student regressions.
- TypeScript, ESLint, regressions and production build. Live financial tests require separately approved fictional fixtures and test-mode operations; no production collection is authorized.

This planning-only change does not rerun application checks unnecessarily. The last executed application checkpoint remains 58 regression tests plus TypeScript, ESLint and build passed; those are not fee-module test results. That historical checkpoint predates the later isolated 38-group financial database test and application preparation; neither establishes live production verification.

## Next approval gate

The business decisions and inventory are available. The proposed migration, read-only verification/capture, recovery proposal and controlled-test matrix are prepared; see PHASE_5_DATABASE_REVIEW.md. All four new SQL scripts pass SQL/PLpgSQL parsing, which does not establish runtime correctness. Request separate approval for isolated database validation before recommending production execution. Do not rerun grant hardening. Razorpay, external sending, production records and financial transactions remain disabled/unapproved. Securely back up the ignored inventory outside the repository with restricted access.

## Approved isolated testing completed

38 isolated PostgreSQL test groups passed after correcting the generated-column bill guard; zero final failures. No production SQL or records were touched. Recovery was tested locally and the temporary server is stopped. See PHASE_5_ISOLATED_TEST_REPORT.md. The earlier isolated-setup approval gate is fulfilled; production read-only prerequisite review and separate corrected-migration approval are still required. Real Supabase Auth/PostgREST and financial UI integration remain unverified.

## Current application checkpoint

Fee overview, signed previews, explicit allocations, concessions/reversal controls, ledgers, receipts, financial reports/CSV and manual reminder preparation are implemented behind disabled server flags. Approval gates are consolidated in OUTSTANDING_APPROVALS.md. The former isolated-testing approval gate has been fulfilled; no new production approval is inferred.
