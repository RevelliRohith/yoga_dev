import { randomUUID } from "node:crypto";
import Link from "next/link";
import { loadBatchChoices } from "@/lib/admin/data";
import { BatchForm } from "../../management-forms";
import { LoadError, ManagementHeading } from "../../management-ui";

export const metadata = { title: "New batch" };

export default async function NewBatchPage() {
  const result = await loadBatchChoices();
  return <><Link href="/admin/batches" className="admin-back">← All batches</Link><ManagementHeading title="Create a batch." description="A consistent rhythm makes room for lasting practice." />
    {!result.data ? <LoadError message={result.error} href="/admin/batches/new" /> : <>
      {!result.data.programs.some(program => program.is_active) && <p className="admin-alert" role="status">You need an active program before creating a batch. <Link href="/admin/programs" className="management-text-link">Manage yoga programs →</Link></p>}
      <BatchForm id={randomUUID()} programs={result.data.programs} trainers={result.data.trainers} />
    </>}
  </>;
}
