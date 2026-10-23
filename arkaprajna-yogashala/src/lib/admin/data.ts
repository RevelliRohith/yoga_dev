import "server-only";

import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, escapeSearch, type Batch, type Program, type ProgramOption, type TrainerOption, type parseFilters } from "./management";

export const PROGRAM_FIELDS = "id,name,description,monthly_fee,is_active,created_at";
export const BATCH_FIELDS = "id,name,program_id,trainer_id,start_time,end_time,days_of_week,is_active,created_at";
type Filters = ReturnType<typeof parseFilters>;

export function databaseError(error: { code?: string } | null, fallback = "The database request could not be completed. Please try again.") {
  const known: Record<string, string> = {
    "23503": "The selected program or trainer is no longer available. Refresh the form and select again.",
    "23505": "This submission was already saved or conflicts with an existing record. Refresh the list before trying again.",
    "23514": "A value does not meet an existing database constraint. Review the form and try again.",
    "42501": "Database permissions denied this operation. Check the existing administrator RLS policies.",
    "22P02": "A value does not match the existing database column type. Check the schema before retrying.",
    PGRST204: "A required column is unavailable. Confirm the existing database schema and refresh the API schema cache.",
    "42703": "A required column is unavailable. Confirm the existing database schema.",
  };
  const message = known[error?.code ?? ""] ?? fallback;
  const code = error?.code;
  return process.env.NODE_ENV === "development" && code && /^[a-zA-Z0-9_]{1,32}$/.test(code)
    ? `${message} (code: ${code})` : message;
}

// A fingerprint lets an edit detect changes made after its form was opened.
export function recordVersion(record: Program | Batch) {
  return createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

export async function loadPrograms(filters: Filters) {
  await requireAdmin();
  try {
    const db = await createClient();
    let query = db.from("programs").select(PROGRAM_FIELDS, { count: "exact" });
    if (filters.q) query = query.ilike("name", `%${escapeSearch(filters.q)}%`);
    if (filters.status !== "all") query = query.eq("is_active", filters.status === "active");
    const [list, total, active] = await Promise.all([
      query.order("created_at", { ascending: false }).order("id", { ascending: false })
        .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
      db.from("programs").select("id", { count: "exact", head: true }),
      db.from("programs").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    const failure = [list, total, active].find(result => result.error);
    if (failure) return { error: databaseError(failure.error), data: null };
    return { error: "", data: {
      records: list.data as Program[], count: list.count, total: total.count, active: active.count,
    } };
  } catch {
    return { error: "Programs could not be loaded. Check connectivity and try again.", data: null };
  }
}

export async function loadProgram(id: string) {
  await requireAdmin();
  try {
    const db = await createClient();
    const { data, error } = await db.from("programs").select(PROGRAM_FIELDS).eq("id", id).maybeSingle();
    return { data: data as Program | null, error: error ? databaseError(error) : "" };
  } catch {
    return { data: null, error: "The program could not be loaded. Please try again." };
  }
}

async function choices(db: Awaited<ReturnType<typeof createClient>>) {
  // Separate lookups respect existing FKs without assuming PostgREST relationship names.
  // Explicit name-only profile selection keeps private contact fields off the client.
  const [programs, trainers] = await Promise.all([
    choiceRows(db, "programs"),
    choiceRows(db, "profiles"),
  ]);
  if (programs.error || trainers.error) return {
    data: null, error: databaseError(programs.error ?? trainers.error, "Program or trainer choices could not be loaded."),
  };
  return { data: { programs: programs.data as ProgramOption[], trainers: trainers.data as TrainerOption[] }, error: "" };
}

async function choiceRows(db: Awaited<ReturnType<typeof createClient>>, table: "programs" | "profiles") {
  const records: (ProgramOption | TrainerOption)[] = [];
  // Fetch every choice, rather than silently truncating at the REST row limit.
  for (;;) {
    let query = db.from(table).select(table === "programs" ? "id,name,is_active" : "id,full_name", { count: "exact" })
      .order(table === "programs" ? "name" : "full_name").order("id");
    if (table === "profiles") query = query.eq("role", "trainer");
    const { data, error, count } = await query.range(records.length, records.length + 499);
    if (error) return { data: null, error };
    if (!data?.length) break;
    records.push(...data as unknown as (ProgramOption | TrainerOption)[]);
    if (count === null ? data.length < 500 : records.length >= count) break;
  }
  return { data: records, error: null };
}

export async function loadBatchChoices() {
  await requireAdmin();
  try { return await choices(await createClient()); }
  catch { return { data: null, error: "Program or trainer choices could not be loaded. Check connectivity and try again." }; }
}

export async function loadBatches(filters: Filters) {
  await requireAdmin();
  try {
    const db = await createClient();
    let query = db.from("batches").select(BATCH_FIELDS, { count: "exact" });
    if (filters.q) query = query.ilike("name", `%${escapeSearch(filters.q)}%`);
    if (filters.status !== "all") query = query.eq("is_active", filters.status === "active");
    if (filters.program) query = query.eq("program_id", filters.program);
    const [list, total, active, options] = await Promise.all([
      query.order("created_at", { ascending: false }).order("id", { ascending: false })
        .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
      db.from("batches").select("id", { count: "exact", head: true }),
      db.from("batches").select("id", { count: "exact", head: true }).eq("is_active", true),
      choices(db),
    ]);
    const failure = [list, total, active].find(result => result.error);
    if (failure || !options.data) return { data: null, error: failure ? databaseError(failure.error) : options.error };
    return { error: "", data: {
      records: list.data as Batch[], count: list.count, total: total.count, active: active.count, ...options.data,
    } };
  } catch {
    return { error: "Batches could not be loaded. Check connectivity and try again.", data: null };
  }
}

export async function loadBatch(id: string) {
  await requireAdmin();
  try {
    const db = await createClient();
    const { data, error } = await db.from("batches").select(BATCH_FIELDS).eq("id", id).maybeSingle();
    return { data: data as Batch | null, error: error ? databaseError(error) : "" };
  } catch {
    return { data: null, error: "The batch could not be loaded. Please try again." };
  }
}

export async function loadOverviewCounts() {
  await requireAdmin();
  try {
    const db = await createClient();
    const results = await Promise.all([
      db.from("programs").select("id", { count: "exact", head: true }),
      db.from("programs").select("id", { count: "exact", head: true }).eq("is_active", true),
      db.from("batches").select("id", { count: "exact", head: true }),
      db.from("batches").select("id", { count: "exact", head: true }).eq("is_active", true),
      db.from("students").select("id", { count: "exact", head: true }),
      db.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
      db.from("profiles").select("id", {count:"exact",head:true}).eq("role","trainer"),
    ]);
    const failure = results.find(result => result.error);
    if (failure) return { data: null, error: databaseError(failure.error, "Studio counts are temporarily unavailable.") };
    return { data: { programs: results[0].count, activePrograms: results[1].count, batches: results[2].count, activeBatches: results[3].count, students: results[4].count, activeStudents: results[5].count, trainers: results[6].count }, error: "" };
  } catch {
    return { data: null, error: "Studio counts are temporarily unavailable. Please refresh." };
  }
}
