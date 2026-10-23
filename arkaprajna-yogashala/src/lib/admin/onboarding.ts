import { trainerText, validateTrainerFields } from "./trainers";

export const ONBOARDING_APP = "arkaprajna.trainer-onboarding.v1";
export type OnboardingState = { error: string; fieldErrors: Record<string, string>; resumeId?: string };
export const INITIAL_ONBOARDING_STATE: OnboardingState = { error: "", fieldErrors: {} };
export function validateOnboarding(form: FormData) {
  const fields = new FormData();
  for (const name of ["full_name", "phone", "specialization", "qualifications", "biography", "years_of_experience"]) {
    fields.set(name, trainerText(form, name));
  }
  fields.set("is_active", "true");
  const result = validateTrainerFields(fields);
  const email = trainerText(form, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) result.fieldErrors.email = "Enter a valid email address.";
  return { ...result, email };
}
