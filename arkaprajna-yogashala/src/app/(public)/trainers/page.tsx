import { publicContent } from "@/lib/studio/public-data";
export const metadata = { title: "Teachers | Arkaprajna Yogashala" };
export default async function Trainers() {
  const { settings: s } = await publicContent();
  return (
    <section className="public-section">
      <p className="public-eyebrow">GUIDANCE WITH CARE</p>
      <h1>Meet your teachers.</h1>
      <div className="public-cards">
        {s.trainers.map((t) => (
          <article key={t.name}>
            <div className="teacher-monogram" aria-hidden="true">
              {t.name[0]}
            </div>
            <h2>{t.name}</h2>
            <p>{t.specialization}</p>
            <p>{t.qualifications}</p>
            <p>{t.biography}</p>
          </article>
        ))}
      </div>
      {!s.trainers.length && (
        <p className="public-empty">
          Teacher introductions will appear once approved for publication.
          Private trainer records are not published automatically.
        </p>
      )}
    </section>
  );
}
