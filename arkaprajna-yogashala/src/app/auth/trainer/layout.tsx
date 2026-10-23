import type { Metadata } from "next";
import "../../admin/admin.css";

export const metadata: Metadata = { title: "Trainer setup | Arkaprajna Yogashala", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function TrainerSetupLayout({ children }: { children: React.ReactNode }) {
  return <main className="admin-root trainer-auth"><section className="trainer-auth-card"><p className="admin-eyebrow">ARKAPRAJNA YOGASHALA</p>{children}</section></main>;
}
