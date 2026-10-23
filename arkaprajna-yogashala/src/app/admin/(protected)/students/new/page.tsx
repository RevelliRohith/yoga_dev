import { randomUUID } from "node:crypto";
import { loadStudentForm } from "@/lib/admin/student-data";
import { LoadError, ManagementHeading } from "../../management-ui";
import { StudentForm } from "../../student-forms";
export const metadata = { title: "Register student | Arkaprajna Yogashala" };
export default async function NewStudentPage() {
  const result = await loadStudentForm();
  if (!result.data) return <LoadError message={result.error} href="/admin/students/new" />;
  return <><ManagementHeading title="Begin a new practice." description="Register a student with a unique studio code. No login account is created." /><StudentForm id={randomUUID()} choices={result.data} /></>;
}
