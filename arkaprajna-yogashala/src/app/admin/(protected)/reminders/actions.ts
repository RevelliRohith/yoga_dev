"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { operationsWrite } from "@/lib/studio/admin-data";
import { isUuid } from "@/lib/admin/management";
import { type ActionState } from "@/lib/studio/model";
export async function markReminder(_state: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!operationsWrite() || process.env.STUDIO_EXTENSIONS_ENABLED !== "true") return { error: "Reminder tracking is disabled pending approval and activation.", message: "" };
  const id = String(form.get("id") || ""), handled = String(form.get("handled") || "");
  const [source, entity, cycle, extra] = id.split(":");
  if (extra !== undefined || !isUuid(entity) || !["fee", "payment", "inquiry", "event"].includes(source) || !/^[0-9T.Z-]{1,40}$/.test(cycle || "") || !["true", "false"].includes(handled)) return { error: "Reload the reminder before updating its status.", message: "" };
  try {
    const db = await createClient();
    const table = { fee: "fee_bills", payment: "fee_payments", inquiry: "studio_inquiries", event: "studio_events" }[source]!;
    const record = await db.from(table).select("id").eq("id", entity).maybeSingle();
    if (record.error || !record.data) return { error: "The reminder source is unavailable. Reload before retrying.", message: "" };
    const r = await db.rpc("studio_set_reminder", { p_id: id, p_handled: handled === "true" });
    if (r.error || r.data !== true) throw new Error();
    revalidatePath("/admin/reminders");
    return { error: "", message: handled === "true" ? "Marked handled. This does not confirm sending." : "Returned to the review queue." };
  } catch { return { error: "Status was not confirmed. Refresh before retrying.", message: "" }; }
}
