"use server";
import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError } from "@/lib/admin/data";
import { STUDENT_FIELDS, studentVersion } from "@/lib/admin/student-data";
import { validateStudent, indianToday, type Student } from "@/lib/admin/students";
import type { SaveState } from "@/lib/admin/management";
const failure = (error: string): SaveState => ({ error, fieldErrors: {} });
export async function saveStudent(_state: SaveState, form: FormData): Promise<SaveState> {
  await requireAdmin();
  const input = validateStudent(form);
  if (Object.keys(input.fieldErrors).length) return { error: "Please correct the highlighted fields.", fieldErrors: input.fieldErrors };
  try {
    const db = await createClient();
    let current: Student | null = null;
    if (input.mode === "edit") {
      const found = await db.from("students").select(STUDENT_FIELDS).eq("id", input.id).maybeSingle();
      if (found.error) return failure(databaseError(found.error));
      current = found.data as Student | null;
      if (!current || studentVersion(current) !== input.version) return failure("This student record changed or is unavailable. Reload before saving.");
      if ((current.batch_id !== input.values.batch_id || current.program_id !== input.values.program_id || current.status !== input.values.status) && form.get("confirm_enrollment") !== "on") return { error: "Confirm the enrollment or status change before saving.", fieldErrors: { confirm_enrollment: "Please confirm the change." } };
    }
    if (input.values.program_id) {
      const p = await db.from("programs").select("id,is_active").eq("id", input.values.program_id).maybeSingle();
      if (p.error) return failure(databaseError(p.error));
      if (!p.data || (!p.data.is_active && current?.program_id !== p.data.id)) return { error: "Choose an available program.", fieldErrors: { program_id: "New enrollments require an active program." } };
    }
    if (input.values.batch_id) {
      const b = await db.from("batches").select("id,program_id,is_active").eq("id", input.values.batch_id).maybeSingle();
      if (b.error) return failure(databaseError(b.error));
      if (!b.data || b.data.program_id !== input.values.program_id || (!b.data.is_active && current?.batch_id !== b.data.id)) return { error: "Choose an available batch for this program.", fieldErrors: { batch_id: "Select a matching active batch. Existing enrollments may retain their inactive batch." } };
    }
    if (!current) {
      // Random studio code, immutable after creation; the existing UNIQUE constraint is authoritative.
      const student_code = `AY-${indianToday().slice(0, 4)}-${randomBytes(5).toString("hex").toUpperCase()}`;
      const inserted = await db.from("students").insert({ id: input.id, student_code, ...input.values }).select("id").maybeSingle();
      if (inserted.error) return failure(databaseError(inserted.error, "Registration could not be confirmed. Refresh the list before retrying."));
      if (!inserted.data) return failure("Registration was not confirmed. Refresh the list before retrying.");
    } else {
      let update = db.from("students").update(input.values).eq("id", input.id).eq("student_code", current.student_code);
      for (const key of Object.keys(input.values) as (keyof typeof input.values)[]) update = current[key] === null ? update.is(key, null) : update.eq(key, current[key]);
      const saved = await update.select("id").maybeSingle();
      if (saved.error) return failure(databaseError(saved.error));
      if (!saved.data) return failure("Another administrator changed this student. Reload before saving again.");
    }
  } catch { return failure("The save could not be confirmed. Refresh the student list before retrying."); }
  revalidatePath("/admin", "layout"); revalidatePath("/trainer", "layout");
  redirect(`/admin/students/${input.id}?notice=${input.mode === "create" ? "created" : "updated"}`);
}
