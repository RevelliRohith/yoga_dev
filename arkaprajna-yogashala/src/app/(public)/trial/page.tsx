import { randomUUID } from "node:crypto";
import { publicContent } from "@/lib/studio/public-data";
import { InquiryForm } from "./inquiry-form";
import { connection } from "next/server";
export const metadata = { title: "Trial class inquiry | Arkaprajna Yogashala" };
export default async function Trial() {
  await connection();
  const { settings: s } = await publicContent();
  const enabled =
    process.env.PUBLIC_INQUIRIES_ENABLED === "true" &&
    process.env.PUBLIC_CONTENT_ENABLED === "true";
  return (
    <section className="public-section">
      <p className="public-eyebrow">MAKE YOUR FIRST MOVE</p>
      <h1>
        A practice begins
        <br />
        with a conversation.
      </h1>
      <p>
        Share your preferences. A studio administrator can help you explore the
        right class; this form does not confirm a reservation.
      </p>
      {!enabled && (
        <p className="public-alert">
          Online inquiries will open once studio contact information and the
          collection workflow are approved. No submission is collected here yet.
        </p>
      )}
      <InquiryForm
        enabled={enabled}
        id={randomUUID()}
        programs={s.programs.map((p) => p.name)}
      />
    </section>
  );
}
