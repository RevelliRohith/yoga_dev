import { isUuid, escapeSearch, type FieldErrors } from "./management";
export type Student = {
  id: string; student_code: string; full_name: string; date_of_birth: string | null;
  gender: string | null; mobile: string | null; email: string | null; guardian_name: string | null;
  guardian_mobile: string | null; address: string | null; program_id: string | null; batch_id: string | null;
  joining_date: string; status: "active" | "inactive"; created_at: string;
};
export type StudentChoices = { programs: { id: string; name: string; is_active: boolean }[]; batches: { id: string; name: string; program_id: string | null; is_active: boolean }[] };
export const indianToday = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export function mobileNumber(value: string) {
  const compact = value.replace(/[\s().-]/g, "");
  const match = /^(?:\+91|91)?([6-9]\d{9})$/.exec(compact);
  return match ? `+91${match[1]}` : null;
}
export function validDate(value: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function validateStudent(form: FormData) {
  const text = (name: string) => typeof form.get(name) === "string" ? (form.get(name) as string).trim() : "";
  const fieldErrors: FieldErrors = {};
  const id = text("id"), mode = text("mode"), version = text("version");
  if (!isUuid(id) || !["create", "edit"].includes(mode) || (mode === "edit" && !/^[a-f0-9]{64}$/.test(version))) fieldErrors.form = "Reload this student form before saving.";
  const full_name = text("full_name"), date_of_birth = text("date_of_birth"), gender = text("gender");
  const mobile = text("mobile"), email = text("email"), guardian_name = text("guardian_name"), guardian_mobile = text("guardian_mobile"), address = text("address");
  const program_id = text("program_id"), batch_id = text("batch_id"), joining_date = text("joining_date"), status = text("status");
  if (!full_name || full_name.length > 150) fieldErrors.full_name = "Enter a name of 1–150 characters.";
  if (date_of_birth && (!validDate(date_of_birth) || date_of_birth > indianToday())) fieldErrors.date_of_birth = "Enter a valid birth date that is not in the future.";
  if (gender.length > 50) fieldErrors.gender = "Use at most 50 characters.";
  for (const [name, value] of [["mobile", mobile], ["guardian_mobile", guardian_mobile]]) if (value && !mobileNumber(value)) fieldErrors[name] = "Enter a 10-digit Indian mobile number, optionally prefixed with +91.";
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) fieldErrors.email = "Enter a valid email address or leave blank.";
  if (guardian_name.length > 150) fieldErrors.guardian_name = "Use at most 150 characters.";
  if (address.length > 2000) fieldErrors.address = "Use at most 2,000 characters.";
  if (program_id && !isUuid(program_id)) fieldErrors.program_id = "Choose an existing program.";
  if (batch_id && (!isUuid(batch_id) || !program_id)) fieldErrors.batch_id = "Choose a program and one of its batches.";
  if (!validDate(joining_date)) fieldErrors.joining_date = "Enter a valid joining date.";
  if (!["active", "inactive"].includes(status)) fieldErrors.status = "Choose an active or inactive status.";
  return { id, mode, version, fieldErrors, values: {
    full_name, date_of_birth: date_of_birth || null, gender: gender || null, mobile: mobile ? mobileNumber(mobile) : null,
    email: email || null, guardian_name: guardian_name || null, guardian_mobile: guardian_mobile ? mobileNumber(guardian_mobile) : null,
    address: address || null, program_id: program_id || null, batch_id: batch_id || null, joining_date, status: status as "active" | "inactive",
  } };
}
export function studentFilters(search: Record<string, string | string[] | undefined>) {
  const string = (key: string) => typeof search[key] === "string" ? (search[key] as string) : "";
  const q = string("q").trim().slice(0, 120);
  return { q, program: isUuid(string("program")) ? string("program") : "", batch: isUuid(string("batch")) ? string("batch") : "",
    status: ["active", "inactive"].includes(string("status")) ? string("status") : "all",
    page: /^\d{1,6}$/.test(string("page")) ? Math.max(1, Number(string("page"))) : 1 };
}
export function studentSearch(value: string) {
  // Quote values for PostgREST's OR grammar, including commas and parentheses.
  const pattern = `"%${escapeSearch(value).replace(/"/g, '\\"')}%"`;
  return ["full_name", "student_code", "mobile"].map(column => `${column}.ilike.${pattern}`).join(",");
}
export function csvCell(value: unknown) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
