"use client";
import { useActionState, useState } from "react";
import { saveStudio } from "./studio-actions";
import { EMPTY_ACTION, type StudioSettings } from "@/lib/studio/model";
export function StudioForm({
  kind,
  id,
  version = "",
  enabled,
  children,
  allowDraft = false,
}: {
  kind: string;
  id: string;
  version?: string;
  enabled: boolean;
  children: React.ReactNode;
  allowDraft?: boolean;
}) {
  const [s, a, p] = useActionState(saveStudio, EMPTY_ACTION);
  return (
    <form action={a} className="management-editor" aria-busy={p}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="version" value={version} />
      {s.error && (
        <p className="admin-alert" role="alert">
          {s.error}
        </p>
      )}
      {s.message && (
        <p className="admin-notice" role="status">
          {s.message}
        </p>
      )}
      <fieldset disabled={p || (!enabled && !allowDraft)}>
        {children}
        <label>
          <input type="checkbox" name="confirm" required /> I reviewed and
          authorize this change.
        </label>
        <button className="admin-button" disabled={!enabled || p}>
          {p ? "Saving..." : "Confirm save"}
        </button>
      </fieldset>
    </form>
  );
}
export function SettingsFields({
  settings: s,
  trainerChoices = [],
}: {
  settings: StudioSettings;
  trainerChoices?: { id: string; full_name: string }[];
}) {
  const [programs, setPrograms] = useState(Math.max(s.programs.length, 1)),
    [trainers, setTrainers] = useState(Math.max(s.trainers.length, 1));
  return (
    <>
      <h2>Studio information</h2>
      <p>
        Only publish confirmed details. Empty contact fields remain absent from
        the website and receipts.
      </p>
      {(
        [
          ["name", "Studio name"],
          ["intro", "Studio introduction"],
          ["mission", "Mission and approach"],
          ["phone", "Public phone"],
          ["email", "Public email"],
          ["address", "Public address"],
          ["whatsapp", "WhatsApp number (optional)"],
          ["social_url", "Public social link (HTTPS)"],
          ["logo_url", "Approved logo URL (HTTPS, no upload)"],
          ["receipt_footer", "Receipt footer"],
          [
            "certificate_footer",
            "Certificate footer / approved signatory text",
          ],
        ] as const
      ).map(([k, label]) => (
        <label key={k}>
          {label}
          <textarea
            name={k}
            defaultValue={s[k]}
            maxLength={k === "name" ? 150 : 2000}
            required={k === "name"}
            rows={k === "intro" || k === "mission" ? 4 : 2}
          />
        </label>
      ))}
      <h2>Programs approved for public display</h2>
      {Array.from({ length: programs }, (_, i) => (
        <div className="studio-card" key={i}>
          {(
            [
              ["name", "Name"],
              ["description", "Description"],
              ["audience", "Suitable audience"],
            ] as const
          ).map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                name={`program_${k}_${i}`}
                defaultValue={s.programs[i]?.[k]}
                maxLength={2000}
              />
            </label>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="admin-logout"
        disabled={programs >= 30}
        onClick={() => setPrograms(programs + 1)}
      >
        Add public program
      </button>
      <h2>Teacher introductions approved for publication</h2>
      <p>
        These are curated introductions, separate from private trainer profiles.
        Do not enter contact information or publish without permission.
      </p>
      {Array.from({ length: trainers }, (_, i) => (
        <div className="studio-card" key={i}>
          <label>
            Linked active trainer
            <select
              name={`trainer_profile_${i}`}
              defaultValue={s.trainers[i]?.profile_id || ""}
            >
              <option value="">Choose an active trainer</option>
              {trainerChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ["name", "Name"],
              ["specialization", "Specialization"],
              ["qualifications", "Qualifications"],
              ["biography", "Introduction"],
            ] as const
          ).map(([k, l]) => (
            <label key={k}>
              {l}
              <input
                name={`trainer_${k}_${i}`}
                defaultValue={s.trainers[i]?.[k]}
                maxLength={2000}
              />
            </label>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="admin-logout"
        disabled={trainers >= 30}
        onClick={() => setTrainers(trainers + 1)}
      >
        Add public teacher
      </button>
      <label>
        <input type="checkbox" name="publish_consent" required /> All entered
        public details are confirmed and approved for publication.
      </label>
    </>
  );
}
