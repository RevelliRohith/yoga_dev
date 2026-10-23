import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
export const metadata = { title: "Programs | Arkaprajna Yogashala" };
export default async function Programs() {
  const { settings: s } = await publicContent();
  return (
    <section className="public-section">
      <p className="public-eyebrow">FIND YOUR PRACTICE</p>
      <h1>Move at your own pace.</h1>
      <p className="public-lead">
        Explore studio-approved program information. Contact the studio to
        confirm availability and the class that suits you.
      </p>
      <div className="public-cards">
        {s.programs.map((p) => (
          <article key={p.name}>
            <h2>{p.name}</h2>
            <p>{p.description}</p>
            {p.audience && <p>Suitable for: {p.audience}</p>}
            <Link href="/trial">Ask about this program &rarr;</Link>
          </article>
        ))}
      </div>
      {!s.programs.length && (
        <div className="public-empty">
          <h2>Program details are being prepared.</h2>
          <p>
            Ask about the current offerings. Prices and class schedules will be
            shared when confirmed.
          </p>
          <Link href="/trial" className="public-button">
            Make an inquiry
          </Link>
        </div>
      )}
    </section>
  );
}
