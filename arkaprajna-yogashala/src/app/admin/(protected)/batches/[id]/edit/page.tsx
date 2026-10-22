import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/management";
import { loadBatch, loadBatchChoices, recordVersion } from "@/lib/admin/data";
import { BatchForm } from "../../../management-forms";
import { LoadError, ManagementHeading } from "../../../management-ui";

export const metadata = { title: "Edit batch" };

export default async function EditBatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [record, options] = await Promise.all([loadBatch(id), loadBatchChoices()]);
  if (record.error || !options.data) return <LoadError message={record.error || options.error} href={`/admin/batches/${id}/edit`} />;
  if (!record.data) notFound();
  return <><Link href="/admin/batches" className="admin-back">← All batches</Link><ManagementHeading title="Refine your schedule." description="Carefully adjust the details of your studio practice." /><BatchForm id={id} record={record.data} version={recordVersion(record.data)} programs={options.data.programs} trainers={options.data.trainers} /></>;
}
