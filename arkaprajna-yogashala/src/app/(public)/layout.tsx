import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
import "./public.css";
export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { settings: s } = await publicContent();
  return (
    <div className="public-site">
      <a className="public-skip" href="#public-main">
        Skip to content
      </a>
      <header className="public-header">
        <Link href="/" className="public-brand">
          <span aria-hidden="true">
            {s.logo_url ? (
              <Image
                src={s.logo_url}
                width={42}
                height={42}
                alt=""
                unoptimized
              />
            ) : (
              "\u2733"
            )}
          </span>
          <span>
            {s.name}
            <small>YOGA · BREATH · BALANCE</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          {[
            ["/about", "About"],
            ["/programs", "Programs"],
            ["/trainers", "Teachers"],
            ["/events", "Events"],
            ["/contact", "Contact"],
          ].map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <Link href="/trial" className="public-button">
          Find your practice ·
        </Link>
      </header>
      <main id="public-main">{children}</main>
      <footer className="public-footer">
        <div>
          <h2>{s.name}</h2>
          <p>Make space for a steady, considered practice.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/privacy">Privacy</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/trainer/login">Trainer login</Link>
          <Link href="/admin/login">Administrator login</Link>
        </nav>
        <p>
          &copy; {new Date().getFullYear()} {s.name}
        </p>
      </footer>
    </div>
  );
}
