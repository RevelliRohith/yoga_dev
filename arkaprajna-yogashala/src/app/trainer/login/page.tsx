import Link from "next/link";
import { redirect } from "next/navigation";
import { getTrainer } from "@/lib/supabase/trainer";
import { TrainerLoginForm, TrainerLogoutForm } from "../auth-forms";
export default async function TrainerLoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const access = await getTrainer();
  if (access.status === "trainer") redirect("/trainer");
  if (access.status === "admin") redirect("/admin");
  const { reason } = await searchParams;
  return <main className="trainer-auth"><section className="trainer-auth-card"><Link href="/" className="admin-back">← Studio website</Link><p className="admin-eyebrow">ARKAPRAJNA YOGASHALA · TRAINERS</p><h1>A space for your teaching.</h1><p className="admin-muted">Your classes, your students, and the practice you share.</p>{(access.status === "inactive" || reason === "inactive") && <p className="admin-alert">Your trainer account is inactive. Contact the studio administrator.</p>}{reason === "signed-out" && <p className="admin-notice" role="status">You are signed out.</p>}{access.status === "unavailable" && <p className="admin-alert">Account access could not be checked. Please try again.</p>}<TrainerLoginForm />{["inactive", "forbidden", "unavailable"].includes(access.status) && <TrainerLogoutForm />}<Link className="management-text-link" href="/admin/login">Administrator sign-in</Link></section></main>;
}
