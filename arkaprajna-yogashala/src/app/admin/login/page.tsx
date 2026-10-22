import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/supabase/admin";
import { LoginForm, LogoutForm } from "../auth-forms";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Administrator sign in" };

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const result = await getAdmin();
  if (result.user) redirect("/admin");
  const { reason } = await searchParams;
  return (
    <main className="admin-login">
      <section className="admin-story">
        <Link href="/" className="admin-brand"><span className="admin-symbol" aria-hidden="true">✳</span><span>ARKAPRAJNA<small>YOGASHALA</small></span></Link>
        <div className="admin-story-copy"><p className="admin-eyebrow">ROOTED IN PRACTICE</p><h1>A mindful space.<br />A purposeful journey.</h1><p>Nurture your community. Create space for growth. Bring the heart of your studio into every day.</p></div>
        <p className="admin-story-footer">Balance in practice. Clarity in purpose.</p>
      </section>
      <section className="admin-login-panel">
        <Link href="/" className="admin-back">← Back to the yogashala</Link>
        <div className="admin-login-card">
          <span className="admin-pill">STUDIO ADMINISTRATION</span>
          <h2>Welcome back.</h2><p className="admin-muted">Sign in to care for your studio community.</p>
          {reason === "signed-out" && <p className="admin-notice" role="status">You have been signed out.</p>}
          {(result.status === "forbidden" || reason === "forbidden") && <p className="admin-alert" role="alert">Administrator access is required for this space.</p>}
          {(result.status === "unavailable" || reason === "unavailable") && <p className="admin-alert" role="alert">We could not verify access. Please try again shortly.</p>}
          {process.env.NODE_ENV === "development" && <p className="admin-muted admin-small">Development · Supabase project: {getSupabaseConfig().projectHost}. Sign-in errors below include the failed stage, provider code, and HTTP status.</p>}
          {process.env.NODE_ENV === "development" && result.status !== "anonymous" && !result.user && <p className="admin-alert" role="status">{result.diagnostic}</p>}
          <LoginForm />
          {result.status !== "anonymous" && <LogoutForm />}
        </div>
        <p className="admin-login-footer">ARKAPRAJNA YOGASHALA · ADMINISTRATOR PORTAL</p>
      </section>
    </main>
  );
}
