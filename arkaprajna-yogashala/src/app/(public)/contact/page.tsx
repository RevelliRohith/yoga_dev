import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
import { studioContactLinks } from "@/lib/studio/model";
export const metadata = { title: "Contact | Arkaprajna Yogashala" };
export default async function Contact() {
  const { settings: s } = await publicContent();
  const links = studioContactLinks(s);
  return (
    <section className="public-section">
      <p className="public-eyebrow">LET&rsquo;S CONNECT</p>
      <h1>Start a conversation.</h1>
      <div className="public-two">
        <div>
          <h2>Visit & get in touch</h2>
          <p>
            {s.address ||
              "Studio location details will be published once confirmed."}
          </p>
          {s.phone && <p>{s.phone}</p>}
          {s.email && <p>{s.email}</p>}
          {links.maps && (
            <p>
              <a href={links.maps} target="_blank" rel="noopener noreferrer">
                Find the studio on Google Maps
              </a>
            </p>
          )}
          {links.whatsapp && (
              <a
                href={links.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open WhatsApp ·
              </a>
            )}
          {s.social_url && (
            <p>
              <a href={s.social_url} target="_blank" rel="noopener noreferrer">
                Studio social page ·
              </a>
            </p>
          )}
        </div>
        <div>
          <h2>Interested in practicing·</h2>
          <p>
            Share your name, preferred program and a good way for the studio to
            follow up.
          </p>
          <Link href="/trial" className="public-button">
            Trial class / general inquiry ·
          </Link>
        </div>
      </div>
    </section>
  );
}
