"use client";

import { useActionState } from "react";
import { confirmTrainerLink, saveTrainerPassword, finishTrainerSetup } from "./actions";

export function ConfirmTrainerForm({ finished = false }: { finished?: boolean }) {
  const [state, action, pending] = useActionState(async (previous: { error: string }, form: FormData) => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    form.set("token_hash", params.get("token_hash") ?? ""); form.set("type", params.get("type") ?? "");
    // Fragments never reach HTTP logs; discard after the explicit confirmation click.
    window.history.replaceState(null, "", window.location.pathname);
    return confirmTrainerLink(previous, form);
  }, { error: "" });
  return <><h1>{finished ? "You are signed out." : "Welcome to your practice."}</h1><p className="admin-muted">{finished ? "Your session has ended. You can sign in to your trainer workspace at /trainer/login." : "Continue from your invitation or recovery email to choose your password. This signs in the invited trainer in this browser."}</p>
    {!finished && <><p className="admin-notice">Open the latest setup link from your administrator before continuing. If it has expired or was already used, request another email.</p><form action={action} className="admin-form">{state.error && <p className="admin-alert" role="alert">{state.error}</p>}<button className="admin-button" disabled={pending}>{pending ? "Confirming…" : "Continue securely"}</button></form></>}
  </>;
}

export function TrainerPasswordForm() {
  const [state, action, pending] = useActionState(saveTrainerPassword, { error: "" });
  return <form action={action} className="admin-form" aria-busy={pending}><label htmlFor="password">New password</label><input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="password-help" /><small id="password-help">Use 12–128 characters. A unique passphrase is a good choice.</small><label htmlFor="confirmation">Confirm password</label><input id="confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />{state.error && <p className="admin-alert" role="alert">{state.error}</p>}<button className="admin-button" disabled={pending}>{pending ? "Saving…" : "Save my password"}</button></form>;
}
export function FinishSetupForm() {
  const [state, action, pending] = useActionState(finishTrainerSetup, { error: "" });
  return <form action={action} className="admin-form">{state.error && <p className="admin-alert" role="alert">{state.error}</p>}<button className="admin-button" disabled={pending}>{pending ? "Signing out…" : "Finish & sign out"}</button></form>;
}
