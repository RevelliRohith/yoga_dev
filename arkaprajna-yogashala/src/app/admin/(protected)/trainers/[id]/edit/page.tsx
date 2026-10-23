import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { loadTrainer, trainerVersion } from "@/lib/admin/trainer-data";
import { isUuid } from "@/lib/admin/management";
import { LoadError, ManagementHeading } from "../../../management-ui";
import { TrainerForm } from "../../../trainer-forms";

export const metadata = { title: "Edit trainer | Arkaprajna Yogashala" };
export default async function EditTrainerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const result = await loadTrainer(id);
  if (result.error) return <LoadError message={result.error} href={`/admin/trainers/${id}/edit`} />;
  if (!result.data) notFound();
  return <><Link className="admin-back" href={`/admin/trainers/${id}`}>← Trainer profile</Link><ManagementHeading title="Support their teaching journey." description="Update this existing trainer profile. Account invitations are managed separately." /><TrainerForm trainer={result.data.trainer} version={trainerVersion(result.data.trainer)} /></>;
}
