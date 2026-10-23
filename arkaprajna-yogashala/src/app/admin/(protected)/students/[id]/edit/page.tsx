import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/supabase/admin";
import { loadStudentForm, studentVersion } from "@/lib/admin/student-data";
import { isUuid } from "@/lib/admin/management";
import { LoadError, ManagementHeading } from "../../../management-ui";
import { StudentForm } from "../../../student-forms";
export const metadata = { title: "Edit student | Arkaprajna Yogashala" };
export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const result = await loadStudentForm(id);
  if (!result.data) return <LoadError message={result.error} href={`/admin/students/${id}/edit`} />;
  if (!result.data.record) notFound();
  return <><ManagementHeading title="Keep their practice connected." description="Update registration details. Confirm enrollment and status changes before saving." /><StudentForm id={id} record={result.data.record} choices={result.data} version={studentVersion(result.data.record)} /></>;
}
