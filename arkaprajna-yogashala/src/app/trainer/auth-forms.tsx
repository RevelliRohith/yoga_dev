"use client";
import { useActionState } from "react";
import { trainerLogin, trainerLogout } from "./actions";
export function TrainerLoginForm() {
  const [state, action, pending] = useActionState(trainerLogin, { error: "" });
  return <form action={action} className="admin-form" aria-busy={pending}><label htmlFor="trainer-email">Email address</label><input id="trainer-email" name="email" type="email" autoComplete="username" required maxLength={254} /><label htmlFor="trainer-password">Password</label><input id="trainer-password" name="password" type="password" autoComplete="current-password" required maxLength={4096} />{state.error && <p className="admin-alert" role="alert">{state.error}</p>}<button className="admin-button" disabled={pending}>{pending ? "Signing in…" : "Sign in to your workspace"}</button><p className="admin-small admin-muted">Need account or password help? Contact your studio administrator.</p></form>;
}
export function TrainerLogoutForm() {
  const [state, action, pending] = useActionState(trainerLogout, { error: "" });
  return <form action={action}><button className="admin-logout" disabled={pending}>{pending ? "Signing out…" : "Sign out"}</button>{state.error && <p className="admin-alert" role="alert">{state.error}</p>}</form>;
}
