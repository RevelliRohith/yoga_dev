import "server-only";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  settingsContent,
  type StudioSettings,
  type StudioEvent,
  type Inquiry,
  type Certificate,
} from "./model";
export const operationsRead = () =>
  process.env.STUDIO_OPERATIONS_READS_ENABLED === "true";
export const operationsWrite = () =>
  operationsRead() && process.env.STUDIO_OPERATIONS_WRITES_ENABLED === "true";
export type StudioArea =
  | "all"
  | "overview"
  | "settings"
  | "events"
  | "inquiries"
  | "certificates"
  | "communications"
  | "reports"
  | "audit";
export async function loadStudio(area: StudioArea = "all", entityId?: string) {
  await requireAdmin();
  if (!operationsRead())
    return {
      data: null,
      error:
        "Studio operations await a separately approved database migration and activation. No records are assumed.",
    };
  try {
    const db = await createClient();
    const needs: Record<StudioArea, string[]> = {
      all: [
        "studio_settings",
        "studio_events",
        "studio_inquiries",
        "studio_certificates",
        "studio_audit",
      ],
      overview: ["studio_events", "studio_inquiries"],
      settings: ["studio_settings"],
      events: ["studio_events"],
      inquiries: ["studio_inquiries"],
      certificates: ["studio_certificates", "studio_settings"],
      communications: ["studio_events", "studio_inquiries"],
      reports: ["studio_events", "studio_inquiries", "studio_certificates"],
      audit: ["studio_audit"],
    };
    const all = async (table: string) => {
      if (!needs[area].includes(table)) return [];
      const rows: unknown[] = [];
      for (;;) {
        let query = db
          .from(table)
          .select(
            area === "overview"
              ? table === "studio_events"
                ? "id,published,starts_at"
                : "id,status"
              : "*",
            { count: "exact" },
          )
          .order("id");
        if (area === "audit" && entityId)
          query = query.eq("source", "students").eq("entity_id", entityId);
        const r = await query.range(rows.length, rows.length + 499);
        if (r.error || r.count === null || !Array.isArray(r.data))
          throw new Error();
        rows.push(...r.data);
        if (rows.length >= r.count) break;
        if (!r.data.length) throw new Error();
      }
      return rows;
    };
    const [settings, events, inquiries, certificates, audit, trainerRows] =
      await Promise.all([
        all("studio_settings"),
        all("studio_events"),
        all("studio_inquiries"),
        all("studio_certificates"),
        all("studio_audit"),
        (async () => {
          if (area !== "settings" && area !== "all") return [];
          const r = await db
            .from("profiles")
            .select("id,full_name")
            .eq("role", "trainer")
            .eq("is_active", true)
            .order("full_name")
            .limit(1000);
          if (r.error) throw new Error();
          return r.data;
        })(),
      ]);
    return {
      data: {
        trainerChoices: trainerRows as { id: string; full_name: string }[],
        settingsVersion:
          (settings[0] as { updated_at?: string })?.updated_at || "",
        settings: settingsContent(
          (settings[0] as { content?: StudioSettings })?.content,
          true,
        ),
        events: events as StudioEvent[],
        inquiries: inquiries as Inquiry[],
        certificates: certificates as Certificate[],
        audit: audit as {
          id: string;
          entity_id: string;
          source: string;
          action: string;
          created_at: string;
          details: unknown;
        }[],
      },
      error: "",
    };
  } catch {
    return {
      data: null,
      error:
        "Studio records are unavailable. Check the approved schema, permissions and connection.",
    };
  }
}
