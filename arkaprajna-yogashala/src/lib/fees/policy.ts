import { validDate } from "../admin/students";
export class FeeInputError extends Error {}
export const MAX_PAISE = 99999999999;
export function paise(value: string) {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value))
    throw new FeeInputError(
      "Enter an INR amount with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  const result = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (result > BigInt(MAX_PAISE))
    throw new FeeInputError("Amount exceeds the supported limit.");
  return Number(result);
}
export function wholePaise(value: unknown): number {
  if (!/^(0|[1-9]\d*)$/.test(String(value)))
    throw new FeeInputError("Invalid stored monetary amount.");
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new FeeInputError("Amount exceeds safe arithmetic limits.");
  return n;
}
export function sumPaise(values: number[]) {
  return values.reduce((a, b) => wholePaise(a + wholePaise(b)), 0);
}
export function inr(value: number | string) {
  const n = wholePaise(value);
  return `₹${Math.floor(n / 100).toLocaleString("en-IN")}.${String(n % 100).padStart(2, "0")}`;
}
export function feeStatus(
  due: number,
  paid: number,
  month: string,
  today: string,
) {
  if (!validDate(`${month}-01`) || !validDate(today) || paid > due)
    throw new FeeInputError("Invalid bill state.");
  wholePaise(due);
  wholePaise(paid);
  return {
    status: paid === due ? "paid" : paid === 0 ? "unpaid" : "partially_paid",
    outstanding: due - paid,
    overdue: due > paid && today >= `${month}-16`,
    grace: due > paid && today >= `${month}-11` && today <= `${month}-15`,
  };
}
export function csv(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((v) => {
          let s = String(v ?? "");
          if (/^[\s]*[=+@\-]/.test(s)) s = "'" + s;
          return `"${s.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
}
export type Balance = {
  id: string;
  student_id: string;
  billing_month: string;
  due_on: string;
  base_paise: number;
  concession_paise: number;
  due_paise: number;
  paid_paise: number;
  outstanding_paise: number;
  payment_status: string;
  overdue: boolean;
  grace: boolean;
  ledger_version: number;
};
export type Payment = {
  id: string;
  student_id: string;
  amount_paise: number;
  method: string;
  received_on: string;
  receipt_number: string;
  student_code_snapshot: string;
  student_name_snapshot: string;
  reversed_at: string | null;
  external_reference: string | null;
  note: string | null;
};
export type Bill = {
  id: string;
  student_id: string;
  billing_month: string;
  student_name_snapshot: string;
  student_code_snapshot: string;
  source_program_id: string | null;
  program_name_snapshot: string | null;
  concession_reason: string | null;
  source: string;
};
export type Allocation = {
  payment_id: string;
  bill_id: string;
  amount_paise: number;
};
export type FeeData = {
  balances: Balance[];
  payments: Payment[];
  bills: Bill[];
  allocations: Allocation[];
  reversals: {
    id: string;
    payment_id: string;
    kind: string;
    reason: string;
    created_at: string;
  }[];
  events: {
    id: number;
    entity_id: string;
    created_by: string;
    action: string;
    created_at: string;
    details: unknown;
  }[];
};
