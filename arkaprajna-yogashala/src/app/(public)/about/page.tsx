import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
export const metadata = { title: "About | Arkaprajna Yogashala" };
export default async function About() {
  const { settings: s } = await publicContent();
  return (
    <section className="public-section">
      <p className="public-eyebrow">OUR APPROACH</p>
      <h1>Practice with intention.</h1>
      <p className="public-lead">
        {s.intro ||
          "Welcome to Arkaprajna Yogashala. Explore yoga through movement, breath and awareness."}
      </p>
      <div className="public-two">
        <article>
          <h2>Space for your practice.</h2>
          <p>
            {s.mission ||
              "We believe a regular practice starts with attention and patience. Ask the studio about its teaching approach and the classes currently available."}
          </p>
        </article>
        <article>
          <h2>Meet your teachers.</h2>
          <p>
            Published teacher introductions share their specializations and
            qualifications, with their permission.
          </p>
          <Link href="/trainers">Explore teacher introductions &rarr;</Link>
        </article>
      </div>
    </section>
  );
}
