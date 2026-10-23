import Link from "next/link";
import { requireTrainer } from "@/lib/supabase/trainer";
import { TrainerLogoutForm } from "../auth-forms";
export default async function ProtectedTrainerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireTrainer();
  return <div className="trainer-shell"><header className="trainer-topbar"><Link href="/trainer" className="admin-brand"><span aria-hidden="true">✳</span><span>ARKAPRAJNA<small>TRAINER WORKSPACE</small></span></Link><div className="admin-account"><span className="trainer-account-name">{profile.full_name}</span><TrainerLogoutForm /></div></header><nav className="trainer-nav" aria-label="Trainer navigation"><Link href="/trainer">Overview</Link><Link href="/trainer/roster">Student roster</Link><Link href="/trainer/profile">My profile</Link></nav><main className="trainer-content" id="trainer-content">{children}</main><footer className="trainer-footer">Arkaprajna Yogashala · A mindful teaching community</footer></div>;
}
