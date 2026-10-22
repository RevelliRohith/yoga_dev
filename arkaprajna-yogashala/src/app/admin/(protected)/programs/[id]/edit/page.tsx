import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/management";
import { loadProgram, recordVersion } from "@/lib/admin/data";
import { ProgramForm } from "../../../management-forms";
import { LoadError, ManagementHeading } from "../../../management-ui";

export const metadata = { title: "Edit program" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const result = await loadProgram(id);
  if (result.error) return <LoadError message={result.error} href={`/admin/programs/${id}/edit`} />;
  if (!result.data) notFound();
  return <><Link href="/admin/programs" className="admin-back">← All yoga programs</Link><ManagementHeading title="Refine your program." description="Update the details while preserving its studio history." /><ProgramForm id={id} record={result.data} version={recordVersion(result.data)} /></>;
}
