import Link from "next/link";
import { publicContent } from "@/lib/studio/public-data";
export default async function Home() {
  const { settings: s } = await publicContent();
  return (
    <>
      <section className="public-hero">
        <div>
          <p className="public-eyebrow">ARKAPRAJNA YOGASHALA</p>
          <h1>
            Room to breathe.
            <br />
            <em>Space to grow.</em>
          </h1>
          <p>
            A thoughtful yoga practice begins with showing up. Explore movement,
            breath and moments of stillness at your own pace.
          </p>
          <div className="public-actions">
            <Link href="/trial" className="public-button">
              Explore a trial class ·
            </Link>
            <Link href="/programs">Discover our programs &rarr;</Link>
          </div>
          <small>Practice with intention. Begin where you are.</small>
        </div>
        <div className="public-art" aria-hidden="true">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-stem" />
          <span>
            MOVEMENT
            <br />
            BREATH
            <br />
            PRESENCE
          </span>
        </div>
      </section>
      <section className="public-strip">
        <span>Move with awareness</span>
        <span>Return to the breath</span>
        <span>Build a steady practice</span>
      </section>
      <section className="public-section public-two">
        <div>
          <p className="public-eyebrow">A MINDFUL BEGINNING</p>
          <h2>
            A little more presence.
            <br />A little more possibility.
          </h2>
        </div>
        <div>
          <p>
            {s.intro ||
              "Yoga offers a space to pay attention: to how you move, how you breathe and how you meet each day. Discover a practice that makes room for your starting point."}
          </p>
          <Link href="/about">Our approach &rarr;</Link>
        </div>
      </section>
      <section className="public-section public-soft">
        <p className="public-eyebrow">FIND YOUR RHYTHM</p>
        <h2>A practice for your everyday.</h2>
        <div className="public-cards">
          {s.programs.length ? (
            s.programs.slice(0, 3).map((p) => (
              <article key={p.name}>
                <span aria-hidden="true">✳</span>
                <h3>{p.name}</h3>
                <p>{p.description}</p>
                <Link href="/programs">Explore program &rarr;</Link>
              </article>
            ))
          ) : (
            <article>
              <h3>Let&rsquo;s find your starting point.</h3>
              <p>
                Published program information will appear here once confirmed by
                the studio.
              </p>
              <Link href="/trial">Ask about a class &rarr;</Link>
            </article>
          )}
        </div>
      </section>
      <section className="public-section">
        <p className="public-eyebrow">A CONSIDERED APPROACH</p>
        <h2>Less rush. More awareness.</h2>
        <div className="public-cards">
          {[
            [
              "01",
              "Movement",
              "Explore balance, mobility and a more attentive relationship with movement.",
            ],
            [
              "02",
              "Breath",
              "Create moments to slow down and notice the rhythm of your breath.",
            ],
            [
              "03",
              "Consistency",
              "Make room for a regular practice that can evolve with you.",
            ],
          ].map(([n, t, p]) => (
            <article key={n}>
              <small>{n}</small>
              <h3>{t}</h3>
              <p>{p}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="public-section">
        <p className="public-eyebrow">A FEW FIRST QUESTIONS</p>
        <h2>Before you begin.</h2>
        <details className="public-empty">
          <summary>New to yoga?</summary>
          <p>
            Tell the studio about your experience and preferences so an
            appropriate available class can be discussed.
          </p>
        </details>
        <details className="public-empty">
          <summary>Does an inquiry reserve a place?</summary>
          <p>
            No. An inquiry starts a conversation. Confirm the class, time and
            availability directly with the studio.
          </p>
        </details>
        <details className="public-empty">
          <summary>What should I bring?</summary>
          <p>
            Ask the studio about clothing, mats and any class-specific
            preparation before attending.
          </p>
        </details>
      </section>
      <section className="public-cta">
        <p className="public-eyebrow">YOUR NEXT STEP</p>
        <h2>Begin with a conversation.</h2>
        <p>
          Tell us what you&rsquo;re looking for. The studio can help you explore
          the right class.
        </p>
        <Link href="/trial" className="public-button">
          Inquire about a trial ·
        </Link>
      </section>
    </>
  );
}
