import type { Metadata } from "next";
import "../admin/admin.css";
import "./trainer.css";
export const metadata: Metadata = { title: "Trainer workspace | Arkaprajna Yogashala", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function TrainerLayout({ children }: { children: React.ReactNode }) { return <div className="admin-root">{children}</div>; }
