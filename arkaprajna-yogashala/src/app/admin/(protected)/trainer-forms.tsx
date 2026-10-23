"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { INITIAL_SAVE_STATE } from "@/lib/admin/management";
import type { Trainer, AssignedBatch } from "@/lib/admin/trainers";
import { saveTrainer, changeTrainerAssignment } from "./trainer-actions";

export function TrainerForm({ trainer, version }: { trainer: Trainer; version: string }) {
  const [state, action, pending] = useActionState(saveTrainer, INITIAL_SAVE_STATE);
  const [values, setValues] = useState({
    full_name: trainer.full_name, phone: trainer.phone ?? "", specialization: trainer.specialization ?? "",
    qualifications: trainer.qualifications ?? "", biography: trainer.biography ?? "",
    years_of_experience: trainer.years_of_experience === null ? "" : String(trainer.years_of_experience),
    is_active: String(trainer.is_active),
  });
  const fields = [
    { key: "full_name", label: "Full name", max: 150, required: true },
    { key: "phone", label: "Phone", max: 30, type: "tel" },
    { key: "specialization", label: "Specialization", max: 300 },
    { key: "years_of_experience", label: "Years of experience", type: "number" },
    { key: "qualifications", label: "Qualifications", max: 2000, multiline: true },
    { key: "biography", label: "Biography", max: 5000, multiline: true },
  ] as const;
  return <form action={action} className="management-editor trainer-editor" aria-busy={pending}>
    <input type="hidden" name="id" value={trainer.id} /><input type="hidden" name="version" value={version} />
    <div className="management-editor-heading"><h2>Trainer profile</h2><p>Keep teaching experience and contact details up to date.</p></div>
    {state.error && <p role="alert" className="admin-alert">{state.error} {state.fieldErrors.form}</p>}
    <fieldset disabled={pending}><div className="management-form-grid">{fields.map(field => {
      const key = field.key, error = state.fieldErrors[key];
      const props = { id: key, name: key, value: values[key], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues({ ...values, [key]: event.target.value }), "aria-invalid": !!error, "aria-describedby": error ? `${key}-error` : undefined };
      return <div key={key} className={`management-field ${"multiline" in field ? "trainer-wide" : ""}`}><label htmlFor={key}>{field.label}{"required" in field ? " *" : " (optional)"}</label>
        {"multiline" in field ? <textarea {...props} rows={key === "biography" ? 5 : 3} maxLength={field.max} /> : <input {...props} type={"type" in field ? field.type : "text"} required={"required" in field} maxLength={"max" in field ? field.max : undefined} min={key === "years_of_experience" ? 0 : undefined} max={key === "years_of_experience" ? 100 : undefined} step={key === "years_of_experience" ? 1 : undefined} />}
        {error && <span id={`${key}-error`} className="management-field-error">{error}</span>}
      </div>;
    })}<div className="management-field"><label htmlFor="is_active">Status</label><select id="is_active" name="is_active" value={values.is_active} onChange={e => setValues({ ...values, is_active: e.target.value })} aria-invalid={!!state.fieldErrors.is_active} aria-describedby={state.fieldErrors.is_active ? "is_active-error" : "trainer-status-help"}><option value="true">Active</option><option value="false">Inactive</option></select><small id="trainer-status-help">Inactive trainers lose trainer data access. Existing batch assignments are kept.</small>{state.fieldErrors.is_active && <span className="management-field-error" id="is_active-error">{state.fieldErrors.is_active}</span>}</div></div>
      {trainer.is_active && values.is_active === "false" && <div className="management-deactivation"><label><input type="checkbox" name="confirm_deactivation" required aria-describedby="trainer-deactivation-help" /> I confirm deactivation and loss of trainer access.</label><p id="trainer-deactivation-help">The Auth account and batch assignments will be retained.</p>{state.fieldErrors.confirm_deactivation && <span className="management-field-error">{state.fieldErrors.confirm_deactivation}</span>}</div>}
      <div className="management-form-actions"><Link href={`/admin/trainers/${trainer.id}`} className="admin-logout">Cancel</Link><button className="admin-button" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button></div>
    </fieldset>
  </form>;
}

export function AssignmentForm({ trainerId, batches, assignedBatch, active }: { trainerId: string; batches: AssignedBatch[]; assignedBatch?: AssignedBatch; active: boolean }) {
  const [state, action, pending] = useActionState(changeTrainerAssignment, INITIAL_SAVE_STATE);
  const [batchId, setBatchId] = useState(assignedBatch?.id ?? "");
  const batch = assignedBatch ?? batches.find(b => b.id === batchId);
  const replacing = !!batch?.trainer_id && batch.trainer_id !== trainerId;
  const selectId = `assign-${trainerId}`;
  return <form action={action} className="trainer-assignment-form" aria-busy={pending}>
    <input type="hidden" name="trainer_id" value={trainerId} /><input type="hidden" name="expected_trainer_id" value={batch?.trainer_id ?? ""} /><input type="hidden" name="intent" value={assignedBatch ? "unassign" : "assign"} />
    {assignedBatch ? <input type="hidden" name="batch_id" value={assignedBatch.id} /> : <div className="management-field"><label htmlFor={selectId}>Choose an existing batch</label><select id={selectId} name="batch_id" required value={batchId} onChange={e => setBatchId(e.target.value)} disabled={pending || !active}><option value="">Select a batch</option>{batches.filter(b => b.trainer_id !== trainerId).map(b => <option key={b.id} value={b.id}>{b.name}{!b.is_active ? " (inactive batch)" : ""}{b.trainer_id ? " — assigned to another trainer" : " — unassigned"}</option>)}</select></div>}
    {replacing && <label className="trainer-confirm" key={batchId}><input type="checkbox" name="confirm_reassignment" required disabled={pending} /> Reassign this batch from its current trainer.</label>}
    {state.error && <p className="admin-alert" role="alert">{state.error}</p>}
    <button className={assignedBatch ? "admin-logout" : "admin-button"} disabled={pending || (!assignedBatch && (!active || !batchId))} aria-label={assignedBatch ? `Unassign ${assignedBatch.name}` : undefined}>{pending ? "Saving…" : assignedBatch ? "Unassign" : "Assign batch"}</button>
  </form>;
}
