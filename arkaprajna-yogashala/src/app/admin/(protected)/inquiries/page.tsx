import { loadStudio, operationsWrite } from "@/lib/studio/admin-data";
import { ManagementHeading } from "../management-ui";
import { InquiryList } from "./inquiry-list";
export default async function Inquiries() {
  const r = await loadStudio("inquiries");
  return (
    <>
      <ManagementHeading
        title="A thoughtful first conversation."
        description="Review requests, record follow-up notes and track outcomes without automatic enrollment."
      />
      {r.data ? (
        <InquiryList records={r.data.inquiries} enabled={operationsWrite()} />
      ) : (
        <p className="admin-alert">{r.error}</p>
      )}
    </>
  );
}
