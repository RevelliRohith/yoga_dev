import { isUuid } from "../admin/management";
import { mobileNumber, validDate, indianToday } from "../admin/students";
export type StudioSettings = {
  name: string;
  intro: string;
  mission: string;
  phone: string;
  email: string;
  address: string;
  whatsapp: string;
  receipt_footer: string;
  certificate_footer: string;
  social_url: string;
  logo_url: string;
  programs: { name: string; description: string; audience: string }[];
  trainers: {
    profile_id?: string;
    name: string;
    specialization: string;
    qualifications: string;
    biography: string;
  }[];
};
export const EMPTY_SETTINGS: StudioSettings = {
  name: "Arkaprajna Yogashala",
  intro: "",
  mission: "",
  phone: "",
  email: "",
  address: "",
  whatsapp: "",
  receipt_footer: "",
  certificate_footer: "",
  social_url: "",
  logo_url: "",
  programs: [],
  trainers: [],
};
export type StudioEvent = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  venue: string;
  published: boolean;
  updated_at: string;
};
export type Inquiry = {
  id: string;
  full_name: string;
  mobile: string;
  program: string;
  preferred_date: string | null;
  message: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
};
export type Certificate = {
  id: string;
  reference: string;
  participant_name: string;
  title: string;
  issue_date: string;
  created_at: string;
};
export class StudioInputError extends Error {}
export type ActionState = { error: string; message: string };
export const EMPTY_ACTION: ActionState = { error: "", message: "" };
export function safeHttps(value: string) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.toString()
      : "";
  } catch {
    return "";
  }
}
export function validateInquiry(form: FormData) {
  const text = (k: string) => String(form.get(k) || "").trim();
  const full_name = text("full_name"),
    mobile = mobileNumber(text("mobile")),
    program = text("program"),
    preferred_date = text("preferred_date"),
    message = text("message");
  if (text("website"))
    throw new StudioInputError("Submission could not be accepted.");
  if (
    !full_name ||
    full_name.length > 150 ||
    !mobile ||
    program.length > 150 ||
    message.length > 2000 ||
    (preferred_date &&
      (!validDate(preferred_date) || preferred_date < indianToday()))
  )
    throw new StudioInputError(
      "Check your name, mobile number, preferred date and message.",
    );
  if (text("consent") !== "on")
    throw new StudioInputError("Consent to a studio follow-up is required.");
  return {
    full_name,
    mobile,
    program,
    preferred_date: preferred_date || null,
    message,
  };
}
export function settingsFromForm(form: FormData): StudioSettings {
  const result: StudioSettings = {
    ...EMPTY_SETTINGS,
    programs: [],
    trainers: [],
  };
  for (const key of [
    "name",
    "intro",
    "mission",
    "phone",
    "email",
    "address",
    "whatsapp",
    "receipt_footer",
    "certificate_footer",
    "social_url",
    "logo_url",
  ] as const) {
    const value = String(form.get(key) || "").trim();
    if (value.length > 2000)
      throw new StudioInputError("Keep each setting within 2,000 characters.");
    result[key] = value;
  }
  if (!result.name || result.name.length > 150)
    throw new StudioInputError("Enter a studio name.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
    throw new StudioInputError("Check the contact email.");
  if (result.whatsapp && !mobileNumber(result.whatsapp))
    throw new StudioInputError("Use an Indian mobile number for WhatsApp.");
  for (const k of ["social_url", "logo_url"] as const)
    if (result[k] && !safeHttps(result[k]))
      throw new StudioInputError(
        "Public links must be HTTPS URLs without credentials.",
      );
  for (let i = 0; i < 30; i++) {
    const n = String(form.get(`program_name_${i}`) || "").trim();
    if (n)
      result.programs.push({
        name: n,
        description: String(form.get(`program_description_${i}`) || "").trim(),
        audience: String(form.get(`program_audience_${i}`) || "").trim(),
      });
    const t = String(form.get(`trainer_name_${i}`) || "").trim();
    if (t) {
      const profile_id = String(form.get(`trainer_profile_${i}`) || "");
      if (!isUuid(profile_id))
        throw new StudioInputError(
          "Choose an existing trainer for each public introduction.",
        );
      result.trainers.push({
        profile_id,
        name: t,
        specialization: String(
          form.get(`trainer_specialization_${i}`) || "",
        ).trim(),
        qualifications: String(
          form.get(`trainer_qualifications_${i}`) || "",
        ).trim(),
        biography: String(form.get(`trainer_biography_${i}`) || "").trim(),
      });
    }
  }
  for (const row of [...result.programs, ...result.trainers])
    for (const v of Object.values(row))
      if (v && v.length > 2000)
        throw new StudioInputError(
          "Public profile fields must stay within 2,000 characters.",
        );
  return result;
}

export function indianDateTime(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value) ||
    !validDate(value.slice(0, 10)) ||
    Number(value.slice(11, 13)) > 23 ||
    Number(value.slice(14, 16)) > 59 ||
    (value.length > 16 && Number(value.slice(17, 19)) > 59)
  )
    throw new StudioInputError("Enter a real calendar date and time in India.");
  return new Date(value + "+05:30").toISOString();
}
export function eventValues(form: FormData) {
  const t = (k: string) => String(form.get(k) || "").trim();
  if (
    !t("title") ||
    t("title").length > 150 ||
    t("description").length > 10000 ||
    t("venue").length > 300 ||
    !["true", "false"].includes(t("published"))
  )
    throw new StudioInputError(
      "Check the event title, date, venue and visibility.",
    );
  return {
    title: t("title"),
    description: t("description"),
    starts_at: indianDateTime(t("starts_at")),
    venue: t("venue"),
    published: t("published") === "true",
  };
}
export function settingsContent(
  value: unknown,
  includeTrainerIds = false,
): StudioSettings {
  const raw = (
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  ) as Record<string, unknown>;
  const result: StudioSettings = {
    ...EMPTY_SETTINGS,
    programs: [],
    trainers: [],
  };
  for (const key of [
    "name",
    "intro",
    "mission",
    "phone",
    "email",
    "address",
    "whatsapp",
    "receipt_footer",
    "certificate_footer",
    "social_url",
    "logo_url",
  ] as const)
    if (typeof raw[key] === "string")
      result[key] = (raw[key] as string).slice(0, 2000);
  if (!result.name.trim()) result.name = EMPTY_SETTINGS.name;
  result.social_url = safeHttps(result.social_url);
  result.logo_url = safeHttps(result.logo_url);
  if (Array.isArray(raw.programs))
    for (const row of raw.programs.slice(0, 30)) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.name !== "string" ||
        typeof row.description !== "string" ||
        typeof row.audience !== "string"
      )
        continue;
      result.programs.push({
        name: row.name.slice(0, 2000),
        description: row.description.slice(0, 2000),
        audience: row.audience.slice(0, 2000),
      });
    }
  if (Array.isArray(raw.trainers))
    for (const row of raw.trainers.slice(0, 30)) {
      if (
        !row ||
        typeof row !== "object" ||
        typeof row.name !== "string" ||
        typeof row.specialization !== "string" ||
        typeof row.qualifications !== "string" ||
        typeof row.biography !== "string"
      )
        continue;
      result.trainers.push({
        name: row.name.slice(0, 2000),
        specialization: row.specialization.slice(0, 2000),
        qualifications: row.qualifications.slice(0, 2000),
        biography: row.biography.slice(0, 2000),
        ...(includeTrainerIds && isUuid(row.profile_id)
          ? { profile_id: row.profile_id }
          : {}),
      });
    }
  return result;
}
export function publicEvents(value: unknown): StudioEvent[] {
  if (!Array.isArray(value))
    throw new StudioInputError("Published event data is unavailable.");
  return value
    .filter(
      (e) =>
        e &&
        typeof e === "object" &&
        e.published === true &&
        typeof e.id === "string" &&
        isUuid(e.id) &&
        typeof e.title === "string" &&
        typeof e.description === "string" &&
        typeof e.venue === "string" &&
        typeof e.starts_at === "string" &&
        Number.isFinite(Date.parse(e.starts_at)),
    )
    .map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      venue: e.venue,
      starts_at: e.starts_at,
      published: true,
      updated_at: typeof e.updated_at === "string" ? e.updated_at : "",
    }));
}
