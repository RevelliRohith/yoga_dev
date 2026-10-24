import { randomUUID } from "node:crypto";
import { loadStudio, operationsWrite } from "@/lib/studio/admin-data";
import { EMPTY_SETTINGS } from "@/lib/studio/model";
import { indianToday } from "@/lib/admin/students";
import { ManagementHeading } from "../management-ui";
import { CertificateWorkspace } from "./certificate-workspace";
export const metadata = { title: "Certificates | Arkaprajna Yogashala" };
export default async function Certificates() {
  const r = await loadStudio("certificates");
  return (
    <>
      <ManagementHeading
        title="Recognize a meaningful milestone."
        description="Review participation certificates, retain issuance history and print confirmed records."
      />
      {r.error && <p className="admin-alert">{r.error}</p>}
      <CertificateWorkspace
        records={r.data?.certificates || []}
        enabled={operationsWrite() && !!r.data && process.env.STUDIO_EXTENSIONS_ENABLED === "true"}
        available={!!r.data}
        settings={r.data?.settings || EMPTY_SETTINGS}
        createId={randomUUID()}
        today={indianToday()}
      />
    </>
  );
}
