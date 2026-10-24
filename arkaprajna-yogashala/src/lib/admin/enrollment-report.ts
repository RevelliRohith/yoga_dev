import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EnrollmentReport = {
  active: number;
  inactive: number;
  programs: { id: string; name: string; active: number; inactive: number }[];
  batches: { id: string; name: string; trainer: string; active: number; inactive: number }[];
};

export async function loadEnrollmentReport() : Promise<{ data: EnrollmentReport | null; error: string }> {
  await requireAdmin();
  try {
    const db = await createClient();
    async function all(table: string, fields: string, trainers = false) {
      const rows: Record<string, unknown>[] = [];
      for (;;) {
        let query = db.from(table).select(fields, { count: "exact" }).order("id");
        if (trainers) query = query.eq("role", "trainer");
        const result = await query.range(rows.length, rows.length + 499);
        if (result.error || result.count === null || !Array.isArray(result.data)) throw Error();
        rows.push(...(result.data as unknown as Record<string, unknown>[]));
        if (rows.length >= result.count) return rows;
        if (!result.data.length) throw Error();
      }
    }
    const [students, programs, batches, trainers] = await Promise.all([
      all("students", "id,status,program_id,batch_id"),
      all("programs", "id,name"),
      all("batches", "id,name,trainer_id"),
      all("profiles", "id,full_name", true),
    ]);
    if (students.some(s => !["active", "inactive"].includes(String(s.status)))) throw Error();
    const counts = (rows: typeof students) => ({
      active: rows.filter(s => s.status === "active").length,
      inactive: rows.filter(s => s.status === "inactive").length,
    });
    const groups = (rows: typeof programs, key: "program_id" | "batch_id") => [
      ...rows.map(row => ({ id: String(row.id), name: String(row.name), ...counts(students.filter(s => s[key] === row.id)) })),
      { id: "unassigned", name: "Unassigned", ...counts(students.filter(s => !s[key])) },
    ];
    // Refuse partial reference data rather than silently undercounting a group.
    if (students.some(s => (s.program_id && !programs.some(p => p.id === s.program_id)) ||
      (s.batch_id && !batches.some(b => b.id === s.batch_id)))) throw Error();
    return {
      data: {
        ...counts(students),
        programs: groups(programs, "program_id"),
        batches: groups(batches, "batch_id").map(row => {
          const batch = batches.find(b => b.id === row.id);
          const trainer = trainers.find(t => t.id === batch?.trainer_id);
          return { ...row, trainer: trainer ? String(trainer.full_name) : batch?.trainer_id ? "Trainer unavailable" : "Unassigned" };
        }),
      },
      error: "",
    };
  } catch {
    return { data: null, error: "Enrollment reports could not be verified. Refresh to try again; no partial totals are displayed." };
  }
}
