import { FinishSetupForm } from "../setup-forms";
import Link from "next/link";
export default function CompleteTrainerPage() {
  return <><h1>Ready for the next step.</h1><p className="admin-muted">If your password save completed, your trainer account is ready. You can open your workspace or finish by signing out.</p><Link href="/trainer" className="management-text-link">Open trainer workspace</Link><FinishSetupForm /></>;
}
