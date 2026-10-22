"use client";

import { useActionState } from "react";
import { login, logout } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action} className="admin-form">
      <label htmlFor="email">Email address</label>
      <input id="email" name="email" type="email" autoComplete="username" placeholder="you@yourstudio.com" required maxLength={254} />
      <label htmlFor="password">Password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required maxLength={4096} />
      <div aria-live="polite">{state.error && <p className="admin-alert" role="alert">{state.error}</p>}</div>
      <button className="admin-button" disabled={pending}>{pending ? "Signing in…" : "Sign in to your studio →"}</button>
      <p className="admin-muted admin-small">Access is reserved for authorized studio administrators.</p>
    </form>
  );
}

export function LogoutForm() {
  const [state, action, pending] = useActionState(logout, { error: "" });
  return <form action={action}>
    <button className="admin-logout" disabled={pending}>{pending ? "Signing out…" : "Sign out ↗"}</button>
    {state.error && <p className="admin-alert" role="alert">{state.error}</p>}
  </form>;
}
