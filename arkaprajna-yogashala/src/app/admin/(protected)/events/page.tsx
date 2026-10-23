import { randomUUID } from "node:crypto";
import { loadStudio, operationsWrite } from "@/lib/studio/admin-data";
import { ManagementHeading } from "../management-ui";
import { EventWorkspace } from "./event-workspace";
export const metadata = { title: "Events | Arkaprajna Yogashala" };
export default async function Events() {
  const r = await loadStudio("events");
  return (
    <>
      <ManagementHeading
        title="Make room for shared experiences."
        description="Review drafts, search the calendar and explicitly publish approved events."
      />
      {r.error && <p className="admin-alert">{r.error}</p>}
      <EventWorkspace
        available={!!r.data}
        events={r.data?.events || []}
        enabled={operationsWrite() && !!r.data}
        createId={randomUUID()}
        now={new Date().toISOString()}
      />
      <p>
        Image uploads await a separately reviewed Storage configuration. No
        draft is publicly visible.
      </p>
    </>
  );
}
