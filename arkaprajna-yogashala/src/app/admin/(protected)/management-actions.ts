"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BATCH_FIELDS, PROGRAM_FIELDS, databaseError, recordVersion } from "@/lib/admin/data";
import { validateBatch, validateProgram, type Batch, type Program, type SaveState } from "@/lib/admin/management";

const failure = (error: string): SaveState => ({ error, fieldErrors: {} });
const conflict = () => failure("This record changed after you opened the form. Reload it before saving so you do not overwrite another change.");
const confirmation = (data: FormData) => data.get("confirm_deactivation") === "on";

function refreshManagement() {
  revalidatePath("/admin", "layout");
}

export async function saveProgram(_previous: SaveState, data: FormData): Promise<SaveState> {
  await requireAdmin();
  const input = validateProgram(data);
  if (Object.keys(input.errors).length) return { error: "Please correct the highlighted fields.", fieldErrors: input.errors };
  try {
    const db = await createClient();
    if (input.mode === "create") {
      // A stable form UUID makes repeated submissions hit the same primary key.
      const { data: inserted, error } = await db.from("programs").insert({ id: input.id, ...input.values }).select("id").maybeSingle();
      if (error) return failure(databaseError(error));
      if (!inserted) return failure("The program was not confirmed as saved. Refresh the list before retrying.");
    } else {
      const { data: record, error } = await db.from("programs").select(PROGRAM_FIELDS).eq("id", input.id).maybeSingle();
      if (error) return failure(databaseError(error));
      if (!record) return failure("This program is unavailable or you no longer have access to it.");
      const current = record as Program;
      if (recordVersion(current) !== input.version) return conflict();
      if (current.is_active && !input.is_active && !confirmation(data)) return {
        error: "Confirm deactivation before saving.", fieldErrors: { confirm_deactivation: "Please confirm that you want to deactivate this program." },
      };
      // Compare original values in the UPDATE as well to detect concurrent changes.
      let query = db.from("programs").update(input.values).eq("id", input.id)
        .eq("name", current.name).eq("monthly_fee", current.monthly_fee).eq("is_active", current.is_active);
      query = current.description === null ? query.is("description", null) : query.eq("description", current.description);
      const { data: updated, error: updateError } = await query.select("id").maybeSingle();
      if (updateError) return failure(databaseError(updateError));
      if (!updated) return conflict();
    }
  } catch {
    return failure("The save could not be confirmed. Check connectivity and refresh the list before retrying.");
  }
  refreshManagement();
  redirect(`/admin/programs?notice=${input.mode === "create" ? "created" : "updated"}`);
}

export async function saveBatch(_previous: SaveState, data: FormData): Promise<SaveState> {
  await requireAdmin();
  const input = validateBatch(data);
  if (Object.keys(input.errors).length) return { error: "Please correct the highlighted fields.", fieldErrors: input.errors };
  try {
    const db = await createClient();
    let current: Batch | null = null;
    if (input.mode === "edit") {
      const { data: record, error } = await db.from("batches").select(BATCH_FIELDS).eq("id", input.id).maybeSingle();
      if (error) return failure(databaseError(error));
      if (!record) return failure("This batch is unavailable or you no longer have access to it.");
      current = record as Batch;
      if (recordVersion(current) !== input.version) return conflict();
      if (current.is_active && !input.is_active && !confirmation(data)) return {
        error: "Confirm deactivation before saving.", fieldErrors: { confirm_deactivation: "Please confirm that you want to deactivate this batch." },
      };
    }
    // Recheck references on the server; dropdown options and client IDs are untrusted.
    const { data: program, error: programError } = await db.from("programs").select("id,is_active").eq("id", input.values.program_id).maybeSingle();
    if (programError) return failure(databaseError(programError));
    if (!program || (!program.is_active && current?.program_id !== program.id)) return {
      error: "Please select an available program.", fieldErrors: { program_id: "Choose an active program. An existing batch may retain its current inactive program." },
    };
    if (input.values.trainer_id) {
      const { data: trainer, error: trainerError } = await db.from("profiles").select("id").eq("id", input.values.trainer_id).eq("role", "trainer").maybeSingle();
      if (trainerError) return failure(databaseError(trainerError));
      if (!trainer) return {
        error: "Please select an available trainer.", fieldErrors: { trainer_id: "This profile is not an available trainer. Select another trainer or leave it unassigned." },
      };
    }
    if (!current) {
      const { data: inserted, error } = await db.from("batches").insert({ id: input.id, ...input.values }).select("id").maybeSingle();
      if (error) return failure(databaseError(error));
      if (!inserted) return failure("The batch was not confirmed as saved. Refresh the list before retrying.");
    } else {
      let query = db.from("batches").update(input.values).eq("id", input.id)
        .eq("name", current.name).eq("program_id", current.program_id)
        .eq("start_time", current.start_time).eq("end_time", current.end_time)
        .contains("days_of_week", current.days_of_week).containedBy("days_of_week", current.days_of_week)
        .eq("is_active", current.is_active);
      query = current.trainer_id === null ? query.is("trainer_id", null) : query.eq("trainer_id", current.trainer_id);
      const { data: updated, error } = await query.select("id").maybeSingle();
      if (error) return failure(databaseError(error));
      if (!updated) return conflict();
    }
  } catch {
    return failure("The save could not be confirmed. Check connectivity and refresh the list before retrying.");
  }
  refreshManagement();
  redirect(`/admin/batches?notice=${input.mode === "create" ? "created" : "updated"}`);
}
