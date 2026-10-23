"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { operationsWrite } from "@/lib/studio/admin-data";
import {
  settingsFromForm,
  eventValues,
  StudioInputError,
  type ActionState,
} from "@/lib/studio/model";
import { isUuid } from "@/lib/admin/management";
import { validDate, indianToday } from "@/lib/admin/students";
export async function saveStudio(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireAdmin();
  if (!operationsWrite())
    return {
      error:
        "Studio writes are disabled pending migration and activation approval.",
      message: "",
    };
  const t = (k: string) => String(form.get(k) || "").trim();
  if (t("confirm") !== "on")
    return { error: "Review and confirm this change.", message: "" };
  try {
    const db = await createClient(),
      kind = t("kind"),
      id = t("id"),
      version = t("version");
    let result;
    if (kind === "settings") {
      const content = settingsFromForm(form);
      if (t("publish_consent") !== "on")
        throw new StudioInputError(
          "Confirm permission to publish the entered program and trainer details.",
        );
      const trainerIds = [
        ...new Set(content.trainers.map((t) => t.profile_id!)),
      ];
      if (trainerIds.length) {
        const r = await db
          .from("profiles")
          .select("id")
          .in("id", trainerIds)
          .eq("role", "trainer")
          .eq("is_active", true);
        if (r.error || r.data?.length !== trainerIds.length)
          throw new StudioInputError(
            "A linked trainer is inactive or unavailable. Refresh the public introductions before saving.",
          );
      }
      const current = await db
        .from("studio_settings")
        .select("id,updated_at")
        .eq("id", "studio")
        .maybeSingle();
      if (current.error) throw new StudioInputError("Settings unavailable.");
      if (current.data) {
        result = await db
          .from("studio_settings")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", "studio")
          .eq("updated_at", version)
          .select("id");
      } else
        result = await db
          .from("studio_settings")
          .insert({ id: "studio", content })
          .select("id");
    } else if (kind === "event") {
      if (!isUuid(id)) throw new StudioInputError("Reload the event form.");
      const values = {
        ...eventValues(form),
        updated_at: new Date().toISOString(),
      };
      if (values.published && t("publish_consent") !== "on")
        throw new StudioInputError("Confirm approval to publish this event.");
      result = version
        ? await db
            .from("studio_events")
            .update(values)
            .eq("id", id)
            .eq("updated_at", version)
            .select("id")
        : await db
            .from("studio_events")
            .insert({ id, ...values })
            .select("id");
    } else if (kind === "inquiry") {
      if (
        !isUuid(id) ||
        !["new", "contacted", "converted", "closed"].includes(t("status")) ||
        t("notes").length > 4000
      )
        throw new StudioInputError("Check the inquiry status and notes.");
      result = await db
        .from("studio_inquiries")
        .update({
          status: t("status"),
          notes: t("notes"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("updated_at", version)
        .select("id");
    } else if (kind === "certificate") {
      if (
        !isUuid(id) ||
        !t("participant_name") ||
        t("participant_name").length > 150 ||
        !t("title") ||
        t("title").length > 200 ||
        !validDate(t("issue_date")) ||
        t("issue_date") > indianToday()
      )
        throw new StudioInputError(
          "Check participant, event/program and issue date.",
        );
      result = await db
        .from("studio_certificates")
        .insert({
          id,
          reference: `AYC-${t("issue_date").slice(0, 4)}-${id.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
          participant_name: t("participant_name"),
          title: t("title"),
          issue_date: t("issue_date"),
        })
        .select("id");
    } else throw new StudioInputError("Unknown studio operation.");
    if (result.error || !result.data?.length)
      return {
        error:
          result.error?.code === "23505"
            ? "This request or reference already exists. Refresh before retrying."
            : "Save not confirmed, or the record changed. Reload before retrying.",
        message: "",
      };
    revalidatePath("/admin", "layout");
    revalidatePath("/", "layout");
    return {
      error: "",
      message: "Change confirmed. Refresh to review the latest records.",
    };
  } catch (e) {
    return {
      error:
        e instanceof StudioInputError
          ? e.message
          : "Could not confirm this change.",
      message: "",
    };
  }
}
