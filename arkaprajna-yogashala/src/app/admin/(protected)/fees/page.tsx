import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadFees, financialWrites } from "@/lib/fees/data";
import { ManagementHeading } from "../management-ui";
import { FeeWorkspace } from "./workspace";
export const metadata = { title: "Fees & receipts | Arkaprajna Yogashala" };
export default async function FeesPage() {
  await requireAdmin();
  const result = await loadFees();
  let students: {
    id: string;
    full_name: string;
    student_code: string;
    program_id: string | null;
  }[] = [];
  if (result.data) {
    const db = await createClient();
    for (;;) {
      const r = await db
        .from("students")
        .select("id,full_name,student_code,program_id", { count: "exact" })
        .order("id")
        .range(students.length, students.length + 499);
      if (r.error || r.count === null) {
        students = [];
        break;
      }
      students.push(...r.data);
      if (students.length >= r.count) break;
      if (!r.data.length) {
        students = [];
        break;
      }
    }
  }
  return (
    <>
      <ManagementHeading
        title="Clear accounts. More peace of mind."
        description="Monthly billing, explicit allocations and a preserved financial history."
      />
      {result.data ? (
        <FeeWorkspace
          data={result.data}
          students={students}
          enabled={financialWrites()}
        />
      ) : (
        <section className="management-empty" role="status">
          <h2>Financial workspace awaiting activation</h2>
          <p>{result.error}</p>
          <p>
            Due on the 10th · Grace through the 15th · Overdue from the 16th ·
            No penalties
          </p>
          <p>Razorpay is disabled. No financial records have been generated.</p>
        </section>
      )}
    </>
  );
}
