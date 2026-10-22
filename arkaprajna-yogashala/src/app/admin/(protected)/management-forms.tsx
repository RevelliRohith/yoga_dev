"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { INITIAL_SAVE_STATE, WEEKDAYS, type Batch, type Program, type ProgramOption, type TrainerOption } from "@/lib/admin/management";
import { saveBatch, saveProgram } from "./management-actions";

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  return errors[name] ? <span id={`${name}-error`} className="management-field-error">{errors[name]}</span> : null;
}

function FormIdentity({ id, version, editing }: { id: string; version: string; editing: boolean }) {
  return <><input type="hidden" name="id" value={id} /><input type="hidden" name="mode" value={editing ? "edit" : "create"} /><input type="hidden" name="version" value={version} /></>;
}

function StatusField({ active, setActive, deactivating, errors }: {
  active: boolean; setActive: (active: boolean) => void; deactivating: boolean; errors: Record<string, string>;
}) {
  return <>
    <div className="management-field"><label htmlFor="is_active">Status</label><select id="is_active" name="is_active" value={String(active)} onChange={event => setActive(event.target.value === "true")} aria-invalid={!!errors.is_active} aria-describedby={errors.is_active ? "is_active-error" : undefined}><option value="true">Active</option><option value="false">Inactive</option></select><FieldError name="is_active" errors={errors} /></div>
    {deactivating && <div className="management-deactivation"><p>Deactivating keeps this record and its existing associations. No student records will be deleted.</p><label><input type="checkbox" name="confirm_deactivation" required aria-invalid={!!errors.confirm_deactivation} aria-describedby={errors.confirm_deactivation ? "confirm_deactivation-error" : undefined} /> I confirm that I want to deactivate this record.</label><FieldError name="confirm_deactivation" errors={errors} /></div>}
  </>;
}

export function ProgramForm({ id, record, version = "" }: { id: string; record?: Program; version?: string }) {
  const [state, action, pending] = useActionState(saveProgram, INITIAL_SAVE_STATE);
  const [name, setName] = useState(record?.name ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [fee, setFee] = useState(record ? String(record.monthly_fee) : "");
  const [active, setActive] = useState(record?.is_active ?? true);
  const errors = state.fieldErrors;
  return <form action={action} className="management-editor" aria-busy={pending}>
    <FormIdentity id={id} version={version} editing={!!record} />
    <div className="management-editor-heading"><h2>{record ? "Program details" : "A new path to practice"}</h2><p>Define your offering and its monthly investment.</p></div>
    {state.error && <p className="admin-alert" role="alert">{state.error}{errors.form && ` ${errors.form}`}</p>}
    <fieldset disabled={pending}>
      <div className="management-field"><label htmlFor="name">Program name <span aria-hidden="true">*</span></label><input id="name" name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={150} placeholder="e.g. Hatha Yoga" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} /><FieldError name="name" errors={errors} /></div>
      <div className="management-field"><label htmlFor="description">Description <span className="admin-muted">(optional)</span></label><textarea id="description" name="description" rows={5} value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} placeholder="Share the focus and intention of this program…" aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : undefined} /><FieldError name="description" errors={errors} /></div>
      <div className="management-form-grid"><div className="management-field"><label htmlFor="monthly_fee">Monthly fee (INR) <span aria-hidden="true">*</span></label><input id="monthly_fee" name="monthly_fee" type="number" inputMode="decimal" min="0" max="999999999.99" step="0.01" required value={fee} onChange={event => setFee(event.target.value)} placeholder="0.00" aria-invalid={!!errors.monthly_fee} aria-describedby={errors.monthly_fee ? "monthly_fee-error" : "fee-help"} /><small id="fee-help">Enter 0 for a complimentary program.</small><FieldError name="monthly_fee" errors={errors} /></div><StatusField active={active} setActive={setActive} deactivating={!!record?.is_active && !active} errors={errors} /></div>
      <div className="management-form-actions"><Link href="/admin/programs" className="admin-logout">Cancel</Link><button className="admin-button" disabled={pending}>{pending ? "Saving…" : record ? "Save changes" : "Create program"}</button></div>
    </fieldset>
  </form>;
}

export function BatchForm({ id, record, version = "", programs, trainers }: {
  id: string; record?: Batch; version?: string; programs: ProgramOption[]; trainers: TrainerOption[];
}) {
  const [state, action, pending] = useActionState(saveBatch, INITIAL_SAVE_STATE);
  const [name, setName] = useState(record?.name ?? "");
  const [program, setProgram] = useState(record?.program_id ?? "");
  const [trainer, setTrainer] = useState(record?.trainer_id ?? "");
  const [start, setStart] = useState(record?.start_time.slice(0, 5) ?? "");
  const [end, setEnd] = useState(record?.end_time.slice(0, 5) ?? "");
  const [days, setDays] = useState<string[]>(record?.days_of_week ?? []);
  const [active, setActive] = useState(record?.is_active ?? true);
  const errors = state.fieldErrors;
  const availablePrograms = programs.filter(option => option.is_active || option.id === record?.program_id);
  const trainerUnavailable = !!record?.trainer_id && !trainers.some(option => option.id === record.trainer_id);
  return <form action={action} className="management-editor" aria-busy={pending}>
    <FormIdentity id={id} version={version} editing={!!record} />
    <div className="management-editor-heading"><h2>{record ? "Batch details" : "Make space for practice"}</h2><p>Bring a program, a teacher, and a weekly rhythm together.</p></div>
    {state.error && <p className="admin-alert" role="alert">{state.error}{errors.form && ` ${errors.form}`}</p>}
    <fieldset disabled={pending}>
      <div className="management-field"><label htmlFor="name">Batch name <span aria-hidden="true">*</span></label><input id="name" name="name" value={name} onChange={event => setName(event.target.value)} required maxLength={150} placeholder="e.g. Morning practice" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} /><FieldError name="name" errors={errors} /></div>
      <div className="management-form-grid">
        <div className="management-field"><label htmlFor="program_id">Yoga program <span aria-hidden="true">*</span></label><select id="program_id" name="program_id" value={program} onChange={event => setProgram(event.target.value)} required aria-invalid={!!errors.program_id} aria-describedby={errors.program_id ? "program_id-error" : "program-help"}><option value="">Select a program</option>{availablePrograms.map(option => <option key={option.id} value={option.id}>{option.name}{!option.is_active ? " (inactive · current program)" : ""}</option>)}</select><small id="program-help">New assignments use active programs only.</small><FieldError name="program_id" errors={errors} /></div>
        <div className="management-field"><label htmlFor="trainer_id">Assigned trainer</label><select id="trainer_id" name="trainer_id" value={trainer} onChange={event => setTrainer(event.target.value)} aria-invalid={!!errors.trainer_id} aria-describedby={errors.trainer_id ? "trainer_id-error" : "trainer-help"}><option value="">Unassigned</option>{trainerUnavailable && <option value={record!.trainer_id!} disabled>Previous trainer unavailable — choose again</option>}{trainers.map(option => <option key={option.id} value={option.id}>{option.full_name?.trim() || `Trainer ${option.id.slice(0, 8)}`}</option>)}</select><small id="trainer-help">Only existing trainer profiles appear here.</small><FieldError name="trainer_id" errors={errors} /></div>
      </div>
      <div className="management-form-grid">
        <div className="management-field"><label htmlFor="start_time">Class start time <span aria-hidden="true">*</span></label><input id="start_time" name="start_time" type="time" value={start} onChange={event => setStart(event.target.value)} required aria-invalid={!!errors.start_time} aria-describedby={errors.start_time ? "start_time-error" : undefined} /><FieldError name="start_time" errors={errors} /></div>
        <div className="management-field"><label htmlFor="end_time">Class end time <span aria-hidden="true">*</span></label><input id="end_time" name="end_time" type="time" value={end} onChange={event => setEnd(event.target.value)} required aria-invalid={!!errors.end_time} aria-describedby={errors.end_time ? "end_time-error" : "time-help"} /><small id="time-help">Times use the studio’s local time. Same-day classes only.</small><FieldError name="end_time" errors={errors} /></div>
      </div>
      <fieldset className="management-weekdays" aria-describedby={errors.days_of_week ? "days_of_week-error" : undefined}><legend>Practice days <span aria-hidden="true">*</span></legend><div>{WEEKDAYS.map(day => <label key={day.value}><input type="checkbox" name="days_of_week" value={day.value} checked={days.includes(day.value)} onChange={event => setDays(event.target.checked ? [...days, day.value] : days.filter(value => value !== day.value))} /><span>{day.short}</span></label>)}</div><FieldError name="days_of_week" errors={errors} /></fieldset>
      <StatusField active={active} setActive={setActive} deactivating={!!record?.is_active && !active} errors={errors} />
      <div className="management-form-actions"><Link href="/admin/batches" className="admin-logout">Cancel</Link><button className="admin-button" disabled={pending || availablePrograms.length === 0}>{pending ? "Saving…" : record ? "Save changes" : "Create batch"}</button></div>
    </fieldset>
  </form>;
}
