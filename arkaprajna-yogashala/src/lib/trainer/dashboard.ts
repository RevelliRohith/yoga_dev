import "server-only";
import { requireTrainer } from "@/lib/supabase/trainer";
import { isUuid } from "@/lib/admin/management";

export type TrainerBatch = {
  id: string; name: string; program_id: string | null; program_name: string | null;
  start_time: string | null; end_time: string | null; days_of_week: string[] | null; is_active: boolean;
};
export type RosterStudent = { id: string; student_code: string; full_name: string; program_id: string | null; batch_id: string; status: string };
const batchColumns = "id,name,program_id,program_name,start_time,end_time,days_of_week,is_active";
const rosterColumns = "id,student_code,full_name,program_id,batch_id,status";
type Db = Awaited<ReturnType<typeof requireTrainer>>["db"];

async function rpcRows(db: Db, name: string, columns: string) {
  const records: Record<string, unknown>[] = [];
  for (;;) {
    const result = await db.rpc(name, {}, { count: "exact" }).select(columns).order("id").range(records.length, records.length + 499);
    if (result.error || result.count === null || !Array.isArray(result.data)) throw new Error("Trainer data unavailable");
    if (!result.data.length) {
      if (records.length < result.count) throw new Error("Incomplete trainer data");
      break;
    }
    records.push(...result.data as unknown as Record<string, unknown>[]);
    if (records.length > 10000) throw new Error("Trainer data exceeds studio limits");
    if (records.length >= result.count) break;
  }
  const allowed = columns.split(",").sort().join(",");
  const ids = new Set<string>();
  for (const row of records) {
    if (Object.keys(row).sort().join(",") !== allowed || typeof row.id !== "string" || !isUuid(row.id) || ids.has(row.id)) throw new Error("Unexpected trainer data contract");
    ids.add(row.id);
  }
  return records;
}

export async function loadTrainerDashboard() {
  const { db, profile } = await requireTrainer();
  try {
    // No base students/programs reads, privileged key or caller-supplied trainer ID.
    const [batchRows, rosterRows] = await Promise.all([
      rpcRows(db, "trainer_dashboard_batches", batchColumns),
      rpcRows(db, "trainer_student_roster", rosterColumns),
    ]);
    const batches = batchRows as unknown as TrainerBatch[];
    const students = rosterRows as unknown as RosterStudent[];
    const batchIds = new Set(batches.map(b => b.id));
    if (batches.some(b => typeof b.name !== "string" || typeof b.is_active !== "boolean" || (b.days_of_week !== null && (!Array.isArray(b.days_of_week) || b.days_of_week.some(d => typeof d !== "string"))))) throw new Error("Invalid batch shape");
    if (students.some(s => typeof s.full_name !== "string" || typeof s.student_code !== "string" || !batchIds.has(s.batch_id) || !["active", "inactive"].includes(s.status))) throw new Error("Unexpected roster assignment");
    return { profile, data: { batches, students }, error: "" };
  } catch { return { profile, data: null, error: "Your assigned batches or student roster could not be verified. Refresh or contact your studio administrator." }; }
}
