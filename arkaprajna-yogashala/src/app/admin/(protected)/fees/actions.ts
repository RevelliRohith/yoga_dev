"use server";
import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { financialWrites } from "@/lib/fees/data";
import { paise, inr, FeeInputError } from "@/lib/fees/policy";
import { isUuid } from "@/lib/admin/management";
import { indianToday, validDate } from "@/lib/admin/students";
export type FeeState = {
  error: string;
  message: string;
  token?: string;
  preview?: string;
};
const signature = (body: string) =>
  createHmac("sha256", process.env.FINANCIAL_PREVIEW_KEY!)
    .update(body)
    .digest("hex");
export async function feeCommand(
  _state: FeeState,
  form: FormData,
): Promise<FeeState> {
  const admin = await requireAdmin();
  if (!financialWrites())
    return {
      error:
        "Financial writes are disabled pending explicit approval and configuration.",
      message: "",
    };
  const text = (key: string) => String(form.get(key) ?? "").trim();
  try {
    const db = await createClient();
    if (text("stage") === "confirm") {
      const token = text("token"),
        [body, sig] = token.split(".");
      if (
        !body ||
        !sig ||
        !/^[a-f0-9]{64}$/.test(sig) ||
        !timingSafeEqual(
          Buffer.from(sig, "hex"),
          Buffer.from(signature(body), "hex"),
        )
      )
        throw new FeeInputError("Preview is invalid. Prepare it again.");
      const command = JSON.parse(Buffer.from(body, "base64url").toString()) as {
        user: string;
        expires: number;
        rpc: string;
        args: Record<string, unknown>;
      };
      if (
        command.user !== admin.id ||
        command.expires < Date.now() ||
        text("confirm") !== "on"
      )
        throw new FeeInputError("Confirm a current preview before saving.");
      const { error } = await db.rpc(command.rpc, command.args);
      if (error)
        return {
          error: ["23505", "40001", "40P01", "55P03"].includes(error.code)
            ? "Duplicate, concurrent change or lock conflict. Refresh the ledger; retry the same preview only after reviewing whether it committed."
            : "The database did not confirm this operation. Refresh and review the ledger before retrying. No successful payment is assumed.",
          message: "",
          token,
          preview: _state.preview,
        };
      revalidatePath("/admin", "layout");
      return {
        error: "",
        message:
          "Operation confirmed. Refresh the ledger to review its recorded history.",
      };
    }
    const kind = text("kind"),
      id = text("student"),
      bill = text("bill"),
      payment = text("payment"),
      request = randomUUID();
    let rpc = "",
      args: Record<string, unknown> = {},
      preview = "";
    if (kind === "bill") {
      if (!isUuid(id) || !validDate(text("month") + "-01"))
        throw new FeeInputError("Choose a student and valid billing month.");
      const s = await db
        .from("students")
        .select("id,full_name,student_code,program_id,status,joining_date")
        .eq("id", id)
        .single();
      if (s.error) throw new FeeInputError("Student is unavailable.");
      const opening = text("source") === "opening";
      const p = s.data.program_id
        ? await db
            .from("programs")
            .select("id,name,monthly_fee,is_active")
            .eq("id", s.data.program_id)
            .single()
        : null;
      if (!opening && (!p?.data || p.error))
        throw new FeeInputError(
          "Review the student's program before generating a bill.",
        );
      const base = opening
        ? paise(text("amount"))
        : paise(String(p!.data!.monthly_fee));
      const discount = paise(text("concession") || "0");
      if (discount > base)
        throw new FeeInputError("Concession exceeds the bill.");
      if (discount > 0 && text("reason").length < 3)
        throw new FeeInputError("A concession reason is required.");
      args = {
        p_request: request,
        p_student: id,
        p_month: text("month") + "-01",
        p_source: opening ? "opening" : "program",
        p_program: opening ? null : s.data.program_id,
        p_base_paise: base,
        p_concession_paise: discount,
        p_concession_reason: text("reason") || null,
        p_opening_reference: text("reference") || null,
        p_exception_reason: text("exception") || null,
        p_confirm: true,
      };
      rpc = "fee_create_bill";
      preview = `${s.data.full_name} (${s.data.student_code}) ? ${text("month")} ? ${opening ? "Opening balance" : p!.data!.name} ? Base ${inr(base)} ? Concession ${inr(discount)} ? Due ${inr(base - discount)}. Full first-month fee; no proration. Status ${s.data.status}; joined ${s.data.joining_date}.`;
    } else if (kind === "payment") {
      if (
        !isUuid(id) ||
        !validDate(text("date")) ||
        text("date") > indianToday() ||
        !["cash", "upi", "bank_transfer"].includes(text("method")) ||
        text("verified") !== "on"
      )
        throw new FeeInputError(
          "Confirm a received offline payment, its method and date.",
        );
      const allocations = [];
      for (const [key, value] of form.entries())
        if (
          key.startsWith("allocation_") &&
          typeof value === "string" &&
          value.trim()
        ) {
          const bid = key.slice(11);
          if (!isUuid(bid)) throw new FeeInputError("Invalid allocation.");
          const amount = paise(value.trim());
          if (amount > 0)
            allocations.push({ bill_id: bid, amount_paise: amount });
        }
      const amount = paise(text("amount"));
      if (
        !amount ||
        !allocations.length ||
        allocations.reduce((n, a) => n + a.amount_paise, 0) !== amount
      )
        throw new FeeInputError(
          "Allocate every paise explicitly to the selected months.",
        );
      if (text("method") !== "cash" && text("reference").length < 3)
        throw new FeeInputError("A verified bank/UPI reference is required.");
      const b = await db.rpc("fee_bill_balances");
      if (b.error) throw new FeeInputError("Balances unavailable.");
      for (const a of allocations) {
        const row = b.data.find((r: { id: string }) => r.id === a.bill_id);
        if (
          !row ||
          row.student_id !== id ||
          Number(row.outstanding_paise) < a.amount_paise
        )
          throw new FeeInputError(
            "Refresh allocations: a balance or student does not match.",
          );
      }
      args = {
        p_request: request,
        p_student: id,
        p_amount_paise: amount,
        p_method: text("method"),
        p_received_on: text("date"),
        p_reference: text("reference") || null,
        p_note: text("note") || null,
        p_allocations: allocations,
        p_verified: true,
      };
      rpc = "fee_record_payment";
      preview = `Verified ${text("method")} payment ${inr(amount)} on ${text("date")}. Explicit allocations: ${allocations.map((a) => `${b.data.find((r: { id: string }) => r.id === a.bill_id).billing_month}: ${inr(a.amount_paise)}`).join("; ")}. Check for an existing cash entry before confirming; no excess is reallocated.`;
    } else if (kind === "concession") {
      if (!isUuid(bill) || text("reason").length < 3)
        throw new FeeInputError("Choose a bill and supply a reason.");
      const b = await db.rpc("fee_bill_balances");
      const row = b.data?.find((r: { id: string }) => r.id === bill);
      if (b.error || !row) throw new FeeInputError("Bill unavailable.");
      args = {
        p_request: request,
        p_bill: bill,
        p_expected_version: row.ledger_version,
        p_amount_paise: paise(text("amount")),
        p_reason: text("reason"),
        p_confirm: true,
      };
      rpc = "fee_set_concession";
      preview = `Replace the concession for ${row.billing_month} with ₹${text("amount")}. Reason: ${text("reason")}. This may reopen outstanding debt.`;
    } else if (kind === "reversal") {
      if (!isUuid(payment) || text("reason").length < 3)
        throw new FeeInputError(
          "Choose a payment and explain the full reversal.",
        );
      // Refund recording remains separately gated; this action cannot disburse money.
      if (
        text("reversal_kind") === "verified_refund" &&
        process.env.FINANCIAL_REFUNDS_ENABLED !== "true"
      )
        throw new FeeInputError(
          "Refund recording requires separate verification and activation approval.",
        );
      const p = await db
        .from("fee_payments")
        .select("receipt_number,amount_paise,reversed_at")
        .eq("id", payment)
        .single();
      if (p.error || p.data.reversed_at)
        throw new FeeInputError("Choose an existing non-reversed payment.");
      args = {
        p_request: request,
        p_payment: payment,
        p_kind: text("reversal_kind"),
        p_reason: text("reason"),
        p_refund_reference: text("reference") || null,
        p_refund_verified: text("verified") === "on",
        p_confirm: true,
      };
      rpc = "fee_reverse_payment";
      preview = `Reverse the complete receipt ${p.data.receipt_number}, ${inr(p.data.amount_paise)}. Reopen its allocated balances and preserve all history. Reason: ${text("reason")}. No funds are transferred.`;
    } else if (kind === "reminder") {
      if (
        !isUuid(bill) ||
        !["upcoming", "grace", "overdue", "payment_confirmation"].includes(
          text("reminder_kind"),
        )
      )
        throw new FeeInputError("Choose a bill and reminder category.");
      args = {
        p_request: request,
        p_bill: bill,
        p_kind: text("reminder_kind"),
        p_payment: isUuid(payment) ? payment : null,
      };
      rpc = "fee_prepare_reminder";
      preview =
        "Prepare one manual reminder journal entry for administrator review. No external message will be sent.";
    } else throw new FeeInputError("Choose an available operation.");
    const body = Buffer.from(
      JSON.stringify({
        user: admin.id,
        expires: Date.now() + 15 * 60000,
        rpc,
        args,
      }),
    ).toString("base64url");
    return {
      error: "",
      message: "",
      preview,
      token: body + "." + signature(body),
    };
  } catch (error) {
    return {
      error:
        error instanceof FeeInputError
          ? error.message
          : "Could not prepare a verified preview.",
      message: "",
    };
  }
}
