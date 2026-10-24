"use client";
import { useActionState } from "react";
import { CopyMessage } from "@/components/copy-message";
import { EMPTY_ACTION } from "@/lib/studio/model";
import { markReminder } from "./actions";
export function ReminderCard({ id, text, handled, enabled }: { id: string; text: string; handled: boolean; enabled: boolean }) {
  const [state, action, pending] = useActionState(markReminder, EMPTY_ACTION);
  return <div className="studio-card">
    <p>{handled ? "Handled by an operator" : "Awaiting review"}</p>
    <CopyMessage text={text} />
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="handled" value={String(!handled)} />
      <button className="admin-logout" disabled={!enabled || pending}>{pending ? "Saving…" : handled ? "Return to review" : "Mark handled"}</button>
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
    </form>
  </div>;
}
