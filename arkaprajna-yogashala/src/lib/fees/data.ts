import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { wholePaise, type FeeData } from "./policy";
export const financialEnabled = () =>
  process.env.FINANCIAL_READS_ENABLED === "true";
export const financialWrites = () =>
  financialEnabled() &&
  process.env.FINANCIAL_WRITES_ENABLED === "true" &&
  (process.env.FINANCIAL_PREVIEW_KEY?.length ?? 0) >= 32;
export async function loadFees(): Promise<{
  data: FeeData | null;
  error: string;
}> {
  await requireAdmin();
  if (!financialEnabled())
    return {
      data: null,
      error:
        "Financial records are unavailable until the reviewed database migration and read access are explicitly approved and configured. No balances are assumed.",
    };
  try {
    const db = await createClient();
    const all = async (table: string, fields: string) => {
      const rows: Record<string, unknown>[] = [];
      for (;;) {
        const r = await db
          .from(table)
          .select(fields, { count: "exact" })
          .order("id")
          .range(rows.length, rows.length + 499);
        if (r.error || r.count === null) throw new Error();
        rows.push(...(r.data as unknown as Record<string, unknown>[]));
        if (rows.length >= r.count) break;
        if (!r.data.length) throw new Error();
      }
      return rows;
    };
    // RPC has no fixed application row cap; PostgREST pagination must still be exhausted.
    const balances: Record<string, unknown>[] = [];
    for (;;) {
      const r = await db
        .rpc("fee_bill_balances", {}, { count: "exact" })
        .order("id")
        .range(balances.length, balances.length + 499);
      if (r.error || r.count === null) throw new Error();
      balances.push(...r.data);
      if (balances.length >= r.count) break;
      if (!r.data.length) throw new Error();
    }
    const [bills, payments, allocations, reversals, events] = await Promise.all(
      [
        all(
          "fee_bills",
          "id,student_id,billing_month,student_name_snapshot,student_code_snapshot,source_program_id,program_name_snapshot,concession_reason,source",
        ),
        all(
          "fee_payments",
          "id,student_id,amount_paise,method,received_on,receipt_number,student_code_snapshot,student_name_snapshot,reversed_at,external_reference,note",
        ),
        // Composite key: order by payment then bill and page using deterministic ordering.
        (async () => {
          const rows: Record<string, unknown>[] = [];
          for (;;) {
            const r = await db
              .from("fee_allocations")
              .select("payment_id,bill_id,amount_paise", { count: "exact" })
              .order("payment_id")
              .order("bill_id")
              .range(rows.length, rows.length + 499);
            if (r.error || r.count === null) throw new Error();
            rows.push(...r.data);
            if (rows.length >= r.count) break;
            if (!r.data.length) throw new Error();
          }
          return rows;
        })(),
        all("fee_reversals", "id,payment_id,kind,reason,created_at"),
        all("fee_events", "id,entity_id,created_by,action,created_at,details"),
      ],
    );
    const normalize = (rows: Record<string, unknown>[]) =>
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            k.endsWith("_paise") || k === "ledger_version" ? wholePaise(v) : v,
          ]),
        ),
      );
    return {
      data: {
        balances: normalize(balances),
        bills,
        payments: normalize(payments),
        allocations: normalize(allocations),
        reversals,
        events,
      } as unknown as FeeData,
      error: "",
    };
  } catch {
    return {
      data: null,
      error:
        "Financial data could not be verified. Check the approved schema, permissions and connection; no partial totals are displayed.",
    };
  }
}
