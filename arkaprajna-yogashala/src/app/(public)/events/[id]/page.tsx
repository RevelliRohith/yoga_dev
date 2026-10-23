import { notFound } from "next/navigation";
import { publicContent } from "@/lib/studio/public-data";
import { isUuid } from "@/lib/admin/management";
export default async function Event({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { events } = await publicContent();
  const e = events.find((e) => e.id === id);
  if (!e) notFound();
  return (
    <article className="public-section">
      <p className="public-eyebrow">STUDIO EVENT</p>
      <h1>{e.title}</h1>
      <p>
        {new Intl.DateTimeFormat("en-IN", {
          dateStyle: "long",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        }).format(new Date(e.starts_at))}{" "}
        IST
      </p>
      <p>{e.venue}</p>
      <p className="public-prose">{e.description}</p>
    </article>
  );
}
