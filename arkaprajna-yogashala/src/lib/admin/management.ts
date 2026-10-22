export const PAGE_SIZE = 20;

export const WEEKDAYS = [
  { value: "Monday", short: "Mon" },
  { value: "Tuesday", short: "Tue" },
  { value: "Wednesday", short: "Wed" },
  { value: "Thursday", short: "Thu" },
  { value: "Friday", short: "Fri" },
  { value: "Saturday", short: "Sat" },
  { value: "Sunday", short: "Sun" },
] as const;

export type Weekday = typeof WEEKDAYS[number]["value"];
export type FieldErrors = Record<string, string>;
export type SaveState = { error: string; fieldErrors: FieldErrors };
export const INITIAL_SAVE_STATE: SaveState = { error: "", fieldErrors: {} };

export type Program = {
  id: string;
  name: string;
  description: string | null;
  monthly_fee: number | string;
  is_active: boolean;
  created_at: string;
};

export type Batch = {
  id: string;
  name: string;
  program_id: string;
  trainer_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: string[];
  is_active: boolean;
  created_at: string;
};

export type ProgramOption = Pick<Program, "id" | "name" | "is_active">;
export type TrainerOption = { id: string; full_name: string | null };

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function identity(data: FormData, errors: FieldErrors) {
  const id = text(data, "id");
  const mode = text(data, "mode");
  const version = text(data, "version");
  if (!isUuid(id)) errors.form = "The record identifier is invalid. Reload this page.";
  if (mode !== "create" && mode !== "edit") errors.form = "The form is invalid. Reload this page.";
  if (mode === "edit" && !/^[a-f0-9]{64}$/.test(version)) errors.form = "The edit version is invalid. Reload this page.";
  const active = text(data, "is_active");
  if (active !== "true" && active !== "false") errors.is_active = "Choose an active or inactive status.";
  return { id, mode: mode as "create" | "edit", version, is_active: active === "true" };
}

export function validateProgram(data: FormData) {
  const errors: FieldErrors = {};
  const base = identity(data, errors);
  const name = text(data, "name");
  const description = text(data, "description");
  const fee = text(data, "monthly_fee");
  if (!name || name.length > 150) errors.name = "Enter a program name of 1–150 characters.";
  if (description.length > 5000) errors.description = "Keep the description within 5,000 characters.";
  // Validate the decimal representation before conversion; reject exponent, Infinity, and negative values.
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(fee)) errors.monthly_fee = "Enter a fee from ₹0 to ₹999,999,999.99 with at most two decimal places.";
  return {
    errors, ...base,
    values: { name, description: description || null, monthly_fee: Number(fee), is_active: base.is_active },
  };
}

export function validateBatch(data: FormData) {
  const errors: FieldErrors = {};
  const base = identity(data, errors);
  const name = text(data, "name");
  const program_id = text(data, "program_id");
  const trainer_id = text(data, "trainer_id");
  const start_time = text(data, "start_time");
  const end_time = text(data, "end_time");
  const submittedDays = data.getAll("days_of_week");
  const allowedDays: readonly string[] = WEEKDAYS.map(day => day.value);
  const validDays = submittedDays.every(day => typeof day === "string" && allowedDays.includes(day));
  const days_of_week = WEEKDAYS.filter(day => submittedDays.includes(day.value)).map(day => day.value);
  if (!name || name.length > 150) errors.name = "Enter a batch name of 1–150 characters.";
  if (!isUuid(program_id)) errors.program_id = "Select an existing yoga program.";
  if (trainer_id && !isUuid(trainer_id)) errors.trainer_id = "Select a trainer or leave this batch unassigned.";
  const validTime = (time: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (!validTime(start_time)) errors.start_time = "Choose a valid class start time.";
  if (!validTime(end_time)) errors.end_time = "Choose a valid class end time.";
  if (validTime(start_time) && validTime(end_time) && end_time <= start_time) errors.end_time = "End time must be later than start time for a same-day class.";
  if (!validDays || days_of_week.length === 0) errors.days_of_week = "Select at least one valid weekday.";
  return {
    errors, ...base,
    values: { name, program_id, trainer_id: trainer_id || null, start_time, end_time, days_of_week, is_active: base.is_active },
  };
}

export type SearchValues = { q?: string; status?: string; page?: string; program?: string };
export function parseFilters(search: SearchValues) {
  const q = typeof search.q === "string" ? search.q.trim().slice(0, 120) : "";
  const status = ["active", "inactive"].includes(search.status ?? "") ? search.status as "active" | "inactive" : "all";
  const page = typeof search.page === "string" && /^\d{1,6}$/.test(search.page) ? Math.max(1, Number(search.page)) : 1;
  const program = typeof search.program === "string" && isUuid(search.program) ? search.program : "";
  return { q, status, page, program };
}

export function escapeSearch(value: string) {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

export function formatFee(value: number | string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));
}

export function formatTime(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  if (!match) return "Time unavailable";
  const hours = Number(match[1]);
  return `${hours % 12 || 12}:${match[2]} ${hours >= 12 ? "PM" : "AM"}`;
}

export function formatDays(days: string[]) {
  const known = WEEKDAYS.filter(day => days.includes(day.value));
  if (known.length !== days.length) return days.join(", ") || "Schedule unavailable";
  return known.map(day => day.short).join(" · ");
}
