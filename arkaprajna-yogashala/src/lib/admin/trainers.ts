import { isUuid, type SaveState } from "./management";

export type Trainer = {
  id: string; full_name: string; phone: string | null; role: "trainer";
  specialization: string | null; qualifications: string | null; biography: string | null;
  years_of_experience: number | null; is_active: boolean;
};
export type AssignedBatch = {
  id: string; name: string; trainer_id: string | null; is_active: boolean;
  start_time: string | null; end_time: string | null; days_of_week: string[] | null;
};
export const trainerText = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
};
export function validateTrainer(data: FormData) {
  const result = validateTrainerFields(data);
  const { fieldErrors } = result;
  const id = trainerText(data, "id"), version = trainerText(data, "version");
  if (!isUuid(id) || !/^[a-f0-9]{64}$/.test(version)) fieldErrors.form = "Reload this trainer profile before saving.";
  return { id, version, ...result };
}
export function validateTrainerFields(data: FormData) {
  const fieldErrors: SaveState["fieldErrors"] = {};
  const full_name = trainerText(data, "full_name"), phone = trainerText(data, "phone");
  const specialization = trainerText(data, "specialization"), qualifications = trainerText(data, "qualifications");
  const biography = trainerText(data, "biography"), years = trainerText(data, "years_of_experience");
  const status = trainerText(data, "is_active");
  if (!full_name || full_name.length > 150) fieldErrors.full_name = "Enter a name of 1–150 characters.";
  if (phone && (!/^[+\d\s().-]{5,30}$/.test(phone) || phone.replace(/\D/g, "").length < 5)) fieldErrors.phone = "Enter a valid phone number, up to 30 characters.";
  if (specialization.length > 300) fieldErrors.specialization = "Use at most 300 characters.";
  if (qualifications.length > 2000) fieldErrors.qualifications = "Use at most 2,000 characters.";
  if (biography.length > 5000) fieldErrors.biography = "Use at most 5,000 characters.";
  if (years && (!/^\d{1,3}$/.test(years) || Number(years) > 100)) fieldErrors.years_of_experience = "Enter a whole number from 0 to 100, or leave blank.";
  if (status !== "true" && status !== "false") fieldErrors.is_active = "Choose a valid status.";
  return { fieldErrors, values: {
    full_name, phone: phone || null, specialization: specialization || null,
    qualifications: qualifications || null, biography: biography || null,
    years_of_experience: years ? Number(years) : null, is_active: status === "true",
  } };
}
