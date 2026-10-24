import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { operationsRead } from "./admin-data";
export async function loadReminderHistory() {
  await requireAdmin();
  if (!operationsRead() || process.env.STUDIO_EXTENSIONS_ENABLED !== "true")
    return { records: [] as { id: string; handled: boolean }[], error: "Handled-reminder tracking awaits its separately approved database extension." };
  try {
    const db = await createClient();
    const records: { id: string; handled: boolean }[] = [];
    for (;;) {
      const r = await db.from("studio_reminders").select("id,handled", { count: "exact" }).order("id").range(records.length, records.length + 499);
      if (r.error || !Array.isArray(r.data) || r.count === null) throw new Error();
      records.push(...r.data);
      if (records.length >= r.count) break;
      if (!r.data.length) throw new Error();
    }
    return { records, error: "" };
  } catch { return { records: [], error: "Reminder history is unavailable. No handled status is assumed." }; }
}
