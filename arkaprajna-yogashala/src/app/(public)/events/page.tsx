import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
export const metadata = { title: "Events | Arkaprajna Yogashala" };
export default async function Events() {
  const { events, available } = await publicContent();
  const now = new Date().getTime();
  return (
    <section className="public-section">
      <p className="public-eyebrow">COME TOGETHER</p>
      <h1>Moments to connect.</h1>
      <div className="public-cards">
        {events
          .filter((e) => new Date(e.starts_at).getTime() >= now)
          .map((e) => (
            <article key={e.id}>
              <p>
                {new Intl.DateTimeFormat("en-IN", {
                  dateStyle: "long",
                  timeStyle: "short",
                  timeZone: "Asia/Kolkata",
                }).format(new Date(e.starts_at))}{" "}
                IST
              </p>
              <h2>{e.title}</h2>
              <p>{e.venue}</p>
              <Link href={`/events/${e.id}`}>Event details &rarr;</Link>
            </article>
          ))}
      </div>
      {!events.some((e) => new Date(e.starts_at).getTime() >= now) && (
        <p className="public-empty">
          {available
            ? "No upcoming published events. Check back for studio announcements."
            : "Published event information is not available yet. Please check back or contact the studio."}
        </p>
      )}
    </section>
  );
}
