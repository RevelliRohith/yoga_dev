"use client";
import { useActionState } from "react";
import { submitInquiry } from "./actions";
import { EMPTY_ACTION } from "@/lib/studio/model";
export function InquiryForm({
  enabled,
  id,
  programs,
}: {
  enabled: boolean;
  id: string;
  programs: string[];
}) {
  const [state, action, pending] = useActionState(submitInquiry, EMPTY_ACTION);
  return (
    <form action={action} className="public-form" aria-busy={pending}>
      <input type="hidden" name="request_id" value={id} />
      {state.error && (
        <p role="alert" className="public-alert">
          {state.error}
        </p>
      )}
      {state.message ? (
        <p role="status">{state.message}</p>
      ) : (
        <>
          <fieldset disabled={!enabled || pending}>
            <label>
              Full name
              <input
                name="full_name"
                required
                maxLength={150}
                autoComplete="name"
              />
            </label>
            <label>
              Mobile number
              <input
                name="mobile"
                required
                type="tel"
                maxLength={20}
                autoComplete="tel"
              />
            </label>
            <label>
              Preferred program
              <select name="program">
                <option value="">Help me choose / general inquiry</option>
                {programs.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Preferred date (optional)
              <input type="date" name="preferred_date" />
            </label>
            <label>
              Message (optional)
              <textarea name="message" maxLength={2000} rows={4} />
            </label>
            <label className="public-honeypot" aria-hidden="true">
              Website
              <input name="website" tabIndex={-1} autoComplete="off" />
            </label>
            <label className="consent">
              <input name="consent" type="checkbox" required /> I agree that
              studio administrators may use these details to follow up on this
              inquiry.
            </label>
            <button className="public-button">
              {pending ? "Submitting..." : "Send inquiry for review ?"}
            </button>
          </fieldset>
        </>
      )}
    </form>
  );
}
