"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError } from "@/lib/admin/data";
import { TRAINER_FIELDS, trainerVersion } from "@/lib/admin/trainer-data";
import { trainerText, validateTrainer, type Trainer } from "@/lib/admin/trainers";
import { isUuid, type SaveState } from "@/lib/admin/management";

const failure = (error: string): SaveState => ({ error, fieldErrors: {} });
const conflict = () => failure("This record changed or is no longer available. Reload before saving again.");

export async function saveTrainer(_state: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const input = validateTrainer(form);
  if (Object.keys(input.fieldErrors).length) return { error: "Please correct the highlighted fields.", fieldErrors: input.fieldErrors };
  try {
    const db = await createClient();
    const result = await db.from("profiles").select(TRAINER_FIELDS).eq("id", input.id).eq("role", "trainer").maybeSingle();
    if (result.error) return failure(databaseError(result.error));
    const current = result.data as Trainer | null;
    if (!current || trainerVersion(current) !== input.version) return conflict();
    if (current.is_active && !input.values.is_active && form.get("confirm_deactivation") !== "on") {
      return { error: "Confirm deactivation before saving.", fieldErrors: { confirm_deactivation: "Please confirm that trainer access will be blocked." } };
    }
    // Guard every editable original value, including NULLs, against a concurrent edit.
    let update = db.from("profiles").update(input.values).eq("id", input.id).eq("role", "trainer");
    for (const key of Object.keys(input.values) as (keyof typeof input.values)[]) {
      update = current[key] === null ? update.is(key, null) : update.eq(key, current[key]);
    }
    const saved = await update.select("id").maybeSingle();
    if (saved.error) return failure(databaseError(saved.error));
    if (!saved.data) return conflict();
  } catch { return failure("The save could not be confirmed. Refresh before retrying."); }
  revalidatePath("/admin", "layout");
  redirect(`/admin/trainers/${input.id}?notice=updated`);
}

export async function changeTrainerAssignment(_state: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const trainerId = trainerText(form, "trainer_id"), batchId = trainerText(form, "batch_id");
  const expected = trainerText(form, "expected_trainer_id"), intent = trainerText(form, "intent");
  if (!isUuid(trainerId) || !isUuid(batchId) || (expected && !isUuid(expected)) || !["assign", "unassign"].includes(intent)) return failure("The assignment form is invalid. Reload this page.");
  try {
    const db = await createClient();
    const trainer = await db.from("profiles").select("id,is_active").eq("id", trainerId).eq("role", "trainer").maybeSingle();
    if (trainer.error) return failure(databaseError(trainer.error));
    if (!trainer.data) return conflict();
    if (intent === "assign" && !trainer.data.is_active) return failure("Activate this trainer before assigning a new batch.");
    if (intent === "unassign" && expected !== trainerId) return failure("This batch is not assigned to this trainer. Reload the page.");
    if (intent === "assign" && expected && expected !== trainerId && form.get("confirm_reassignment") !== "on") return failure("Confirm reassignment from the current trainer before saving.");
    let update = db.from("batches").update({ trainer_id: intent === "assign" ? trainerId : null }).eq("id", batchId);
    update = expected ? update.eq("trainer_id", expected) : update.is("trainer_id", null);
    const saved = await update.select("id").maybeSingle();
    if (saved.error) return failure(databaseError(saved.error));
    if (!saved.data) return conflict();
  } catch { return failure("The assignment could not be confirmed. Refresh before retrying."); }
  revalidatePath("/admin", "layout");
  redirect(`/admin/trainers/${trainerId}?notice=assignment`);
}
