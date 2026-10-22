import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/admin";
import { ProgramForm } from "../../management-forms";
import { ManagementHeading } from "../../management-ui";

export const metadata = { title: "New program" };

export default async function NewProgramPage() {
  await requireAdmin();
  return <><Link href="/admin/programs" className="admin-back">← All yoga programs</Link><ManagementHeading title="Create a program." description="A considered offering. A new opportunity to grow." /><ProgramForm id={randomUUID()} /></>;
}
