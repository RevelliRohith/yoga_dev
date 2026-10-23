# Phase 5 controlled validation plan — not executed

Separate approval is required to apply the proposal or create fictional fixtures, including in an isolated database. Never use real student records or actual payments. Record results, transaction isolation, request IDs and safe error codes; never retain tokens or credentials in reports.

| Scenario | Expected evidence |
| --- | --- |
| Anonymous and authenticated trainer | No financial rows or RPC execution success; internal functions and sequences inaccessible; direct DML rejected |
| Existing administrator | Admin SELECT succeeds; direct financial writes denied; approved RPCs succeed; Programs/Batches/Students permissions preserved |
| Identity forgery | Nonadmin cannot elevate via role/request configuration or supplied actor fields; Auth identity is independently checked |
| Bill creation | One bill per student/month, first-day period, full admission-month fee; snapshot unchanged after later program rate update |
| Opening balance | Explicit historic month, source/reference, amount and confirmation required; no invented payments |
| Exact money | Reject fractional paise, NaN, infinities, negative/excess values; zero bill Paid, no receipt |
| Partial settlement | Fictional 100000-paise bill: collect 40000 then 60000; balance 60000 then zero; further 1 rejected |
| Explicit advances | Future bill selected explicitly; allocation sum equals total; unallocated excess and cross-student allocation rejected |
| Idempotency | Same UUID/payload returns same record/receipt; changed payload fails; reordered equivalent allocations remain equivalent |
| Duplicate reference | Same active normalized bank/UPI reference rejected; failed transaction creates no payment/allocations/audit rows |
| Atomic multi-bill collection | One invalid allocation rolls back every business row; receipt gaps are permitted, duplicate receipts are not |
| Concurrent collection | Two 70000-paise payments against 100000: at most one succeeds; repeat under READ COMMITTED and REPEATABLE READ; retry full transaction safely |
| Concession race | Concurrent collection/concession cannot reduce due below paid; stale ledger version rejected; reason mandatory |
| Full reversal | Original payment/receipt/allocations retained, settled amount reduced, bill reopened, one reversal only; replay idempotent |
| Refund | Unverified refund rejected; confirmed manual refund requires reference; no transfer performed; partial refund unsupported |
| Audit/immutability | All business writes have actor/time/request and before/after events; confirmed rows cannot be deleted; journal append-only |
| Date boundaries | India midnight, leap February, 10th/11th/15th/16th; paid never overdue; partial may be overdue; no penalties |
| Manual reminders | Queue only on 8th/11th/16th for eligible bills; confirmation requires allocated nonreversed payment; no duplicate daily entries or sends |
| Parent integrity | Referenced student/program hard deletion blocked; original policies/helpers/FKs and original triggers preserved |
| Recovery rehearsal | Separately approved quarantine removes write EXECUTE without deleting records or disabling reads; no automatic restoration |

Live active/inactive/cross-trainer session tests remain pending approved trainer accounts. Do not create accounts as part of this proposal. Application UI tests and financial transaction tests must be reported separately from static metadata and parser checks.
