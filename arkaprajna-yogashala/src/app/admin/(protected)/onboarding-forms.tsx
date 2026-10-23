"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { INITIAL_ONBOARDING_STATE } from "@/lib/admin/onboarding";
import { createTrainer, retryTrainerSetup } from "./onboarding-actions";

export function CreateTrainerForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(createTrainer, INITIAL_ONBOARDING_STATE);
  const [values, setValues] = useState({ full_name: "", email: "", phone: "", specialization: "", qualifications: "", biography: "", years_of_experience: "" });
  const fields = [
    { key: "full_name", label: "Full name", max: 150, required: true },
    { key: "email", label: "Email address", max: 254, type: "email", required: true },
    { key: "phone", label: "Phone", max: 30, type: "tel" },
    { key: "specialization", label: "Specialization", max: 300 },
    { key: "qualifications", label: "Qualifications", max: 2000, multiline: true },
    { key: "biography", label: "Biography", max: 5000, multiline: true },
    { key: "years_of_experience", label: "Years of experience", type: "number" },
  ] as const;
  return <><form action={action} className="management-editor trainer-editor" aria-busy={pending}><div className="management-editor-heading"><h2>A new teacher, a shared intention.</h2><p>Create an active trainer profile and request a secure email invitation. The trainer chooses their own password.</p></div>
    {!enabled && <p className="admin-notice" role="status">Secure onboarding needs administrator configuration before invitations can be sent. Existing trainer management remains available.</p>}
    {state.error && <p className="admin-alert" role="alert">{state.error}</p>}
    <fieldset disabled={pending || !enabled}><div className="management-form-grid">{fields.map(field => {
      const key = field.key, error = state.fieldErrors[key];
      const props = { id: key, name: key, value: values[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [key]: e.target.value }), "aria-invalid": !!error, "aria-describedby": error ? `${key}-error` : undefined };
      return <div className={`management-field ${"multiline" in field ? "trainer-wide" : ""}`} key={key}><label htmlFor={key}>{field.label}{"required" in field ? " *" : " (optional)"}</label>{"multiline" in field ? <textarea {...props} maxLength={field.max} rows={4} /> : <input {...props} type={"type" in field ? field.type : "text"} required={"required" in field} maxLength={"max" in field ? field.max : undefined} min={key === "years_of_experience" ? 0 : undefined} max={key === "years_of_experience" ? 100 : undefined} step={key === "years_of_experience" ? 1 : undefined} />}{error && <span className="management-field-error" id={`${key}-error`}>{error}</span>}</div>;
    })}</div><label className="trainer-confirm"><input type="checkbox" name="confirm_invitation" required /> I confirm this trainer account should be created and a setup invitation requested.</label><div className="management-form-actions"><Link href="/admin/trainers" className="admin-logout">Cancel</Link><button className="admin-button" disabled={pending || !enabled}>{pending ? "Preparing invitation…" : "Create trainer & invite"}</button></div></fieldset>
  </form>{state.resumeId && <section className="management-editor"><h2>Continue existing onboarding</h2><p>The existing Auth identity will be retained. Repair links the saved profile draft without sending email; retry requests an invitation only after a linked profile is verified.</p><SetupAction id={state.resumeId} intent="repair" label="Repair profile link" /><SetupAction id={state.resumeId} intent="invite" label="Repair & retry invitation" /></section>}</>;
}

export function SetupAction({ id, intent, label, disabled = false }: { id: string; intent: "invite" | "repair" | "recovery"; label: string; disabled?: boolean }) {
  const [state, action, pending] = useActionState(retryTrainerSetup, INITIAL_ONBOARDING_STATE);
  return <form action={action} className="trainer-setup-action" aria-busy={pending}><input type="hidden" name="id" value={id} /><input type="hidden" name="intent" value={intent} /><fieldset disabled={pending || disabled}><label className="trainer-confirm"><input type="checkbox" name="confirm_email" required /> {intent === "repair" ? "Confirm repair of this pending trainer profile." : "Confirm this email request. Wait before retrying an uncertain delivery."}</label>{state.error && <p className="admin-alert" role="alert">{state.error}</p>}<button className="admin-logout" disabled={pending || disabled}>{pending ? "Working…" : label}</button></fieldset></form>;
}
