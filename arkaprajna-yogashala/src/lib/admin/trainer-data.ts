import "server-only";
import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError } from "./data";
import { escapeSearch, PAGE_SIZE, type parseFilters } from "./management";
import type { Trainer, AssignedBatch } from "./trainers";

export const TRAINER_FIELDS = "id,full_name,phone,role,specialization,qualifications,biography,years_of_experience,is_active";
export const ASSIGNMENT_FIELDS = "id,name,trainer_id,is_active,start_time,end_time,days_of_week";
export const trainerVersion = (record: Trainer) => createHash("sha256").update(JSON.stringify(record)).digest("hex");

// Paginate reference data too; do not silently lose assignments at the API row cap.
export async function assignmentRows(db: Awaited<ReturnType<typeof createClient>>, trainerIds?: string[]) {
  const records: AssignedBatch[] = [];
  if (trainerIds?.length === 0) return records;
  for (;;) {
    let query = db.from("batches").select(ASSIGNMENT_FIELDS, { count: "exact" }).order("name").order("id");
    if (trainerIds) query = query.in("trainer_id", trainerIds);
    const result = await query.range(records.length, records.length + 499);
    if (result.error) throw new Error(databaseError(result.error));
    if (!result.data?.length) break;
    records.push(...result.data as AssignedBatch[]);
    if (result.count === null ? result.data.length < 500 : records.length >= result.count) break;
  }
  return records;
}

export async function loadTrainers(filters: ReturnType<typeof parseFilters>) {
  await requireAdmin();
  try {
    const db = await createClient();
    let query = db.from("profiles").select(TRAINER_FIELDS, { count: "exact" }).eq("role", "trainer");
    if (filters.q) query = query.ilike("full_name", `%${escapeSearch(filters.q)}%`);
    if (filters.status !== "all") query = query.eq("is_active", filters.status === "active");
    const [list, total, active] = await Promise.all([
      query.order("full_name").order("id").range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "trainer"),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "trainer").eq("is_active", true),
    ]);
    const failure = [list, total, active].find(r => r.error);
    if (failure) return { data: null, error: databaseError(failure.error) };
    const records = list.data as Trainer[];
    const batches = await assignmentRows(db, records.map(t => t.id));
    return { error: "", data: { records, batches, count: list.count, total: total.count, active: active.count } };
  } catch { return { data: null, error: "Trainers or their assignments could not be loaded. Check connectivity and try again." }; }
}

export async function loadTrainer(id: string) {
  await requireAdmin();
  try {
    const db = await createClient();
    const profile = await db.from("profiles").select(TRAINER_FIELDS).eq("id", id).eq("role", "trainer").maybeSingle();
    if (profile.error) return { data: null, error: databaseError(profile.error) };
    if (!profile.data) return { data: null, error: "" };
    const batches = await assignmentRows(db);
    return { data: { trainer: profile.data as Trainer, batches }, error: "" };
  } catch { return { data: null, error: "The trainer profile or batch assignments could not be loaded. Please try again." }; }
}
