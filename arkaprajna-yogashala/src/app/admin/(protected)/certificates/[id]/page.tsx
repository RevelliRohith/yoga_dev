import { notFound } from "next/navigation";
import { loadStudio } from "@/lib/studio/admin-data";
import { isUuid } from "@/lib/admin/management";
import { PrintButton } from "@/components/print-button";
export default async function Certificate({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const r = await loadStudio("certificates");
  if (!r.data) return <p className="admin-alert">{r.error}</p>;
  const c = r.data.certificates.find((c) => c.id === id);
  if (!c) notFound();
  return (
    <>
      <PrintButton />
      <article className="print-document certificate">
        <p className="admin-eyebrow">{r.data.settings.name}</p>
        <h1>Certificate of participation</h1>
        <p>Presented to</p>
        <h2>{c.participant_name}</h2>
        <p>For participation in</p>
        <h3>{c.title}</h3>
        <p>Issued {c.issue_date}</p>
        <p>{r.data.settings.certificate_footer}</p>
        <small>Studio reference {c.reference}</small>
      </article>
    </>
  );
}
