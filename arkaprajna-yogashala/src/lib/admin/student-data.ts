import "server-only";
import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { databaseError } from "./data";
import { PAGE_SIZE } from "./management";
import { studentSearch, type Student, type StudentChoices, type studentFilters } from "./students";

export const STUDENT_FIELDS = "id,student_code,full_name,date_of_birth,gender,mobile,email,guardian_name,guardian_mobile,address,program_id,batch_id,joining_date,status,created_at";
export const STUDENT_LIST_FIELDS = "id,student_code,full_name,mobile,program_id,batch_id,joining_date,status";
export const studentVersion = (record: Student) => createHash("sha256").update(JSON.stringify(record)).digest("hex");
type Db = Awaited<ReturnType<typeof createClient>>;
export function filteredStudents(db: Db, filters: ReturnType<typeof studentFilters>, fields: string) {
  let query = db.from("students").select(fields, { count: "exact" });
  if (filters.q) query = query.or(studentSearch(filters.q));
  if (filters.program) query = query.eq("program_id", filters.program);
  if (filters.batch) query = query.eq("batch_id", filters.batch);
  if (filters.status !== "all") query = query.eq("status", filters.status);
  return query.order("full_name").order("id");
}
export async function studentChoices(db: Db): Promise<StudentChoices> {
  const result: StudentChoices = { programs: [], batches: [] };
  for (const table of ["programs", "batches"] as const) {
    const rows = [];
    for (;;) {
      const data = await db.from(table).select(table === "programs" ? "id,name,is_active" : "id,name,program_id,is_active", { count: "exact" }).order("name").order("id").range(rows.length, rows.length + 499);
      if (data.error || data.count === null) throw new Error("Enrollment choices unavailable");
      if (!data.data?.length) {
        if (rows.length < data.count) throw new Error("Incomplete enrollment choices");
        break;
      }
      rows.push(...data.data);
      if (rows.length >= data.count) break;
    }
    if (table === "programs") result.programs = rows as unknown as StudentChoices["programs"];
    else result.batches = rows as unknown as StudentChoices["batches"];
  }
  return result;
}
export async function loadStudents(filters: ReturnType<typeof studentFilters>) {
  await requireAdmin();
  try {
    const db = await createClient();
    const [list, total, active, choices] = await Promise.all([
      filteredStudents(db, filters, STUDENT_LIST_FIELDS).range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1),
      db.from("students").select("id", { count: "exact", head: true }),
      db.from("students").select("id", { count: "exact", head: true }).eq("status", "active"), studentChoices(db),
    ]);
    const failed = [list, total, active].find(r => r.error);
    if (failed) return { data: null, error: databaseError(failed.error) };
    return { data: { records: list.data as unknown as Pick<Student, "id" | "student_code" | "full_name" | "mobile" | "program_id" | "batch_id" | "joining_date" | "status">[], count: list.count, total: total.count, active: active.count, ...choices }, error: "" };
  } catch { return { data: null, error: "Student records or enrollment choices could not be loaded. Please try again." }; }
}
export async function loadStudentForm(id?: string) {
  await requireAdmin();
  try {
    const db = await createClient();
    const choices = await studentChoices(db);
    const record = id ? await db.from("students").select(STUDENT_FIELDS).eq("id", id).maybeSingle() : { data: null, error: null };
    if (record.error) return { data: null, error: databaseError(record.error) };
    return { data: { record: record.data as Student | null, ...choices }, error: "" };
  } catch { return { data: null, error: "Student details could not be loaded. Please try again." }; }
}
