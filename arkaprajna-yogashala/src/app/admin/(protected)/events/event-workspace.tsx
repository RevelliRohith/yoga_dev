"use client";
import { useState } from "react";
import { StudioForm } from "../studio-forms";
import type { StudioEvent } from "@/lib/studio/model";
function Fields({ event: e }: { event?: StudioEvent }) {
  return (
    <>
      <label>
        Title
        <input name="title" defaultValue={e?.title} required maxLength={150} />
      </label>
      <label>
        Date and time (India)
        <input
          name="starts_at"
          type="datetime-local"
          required
          defaultValue={
            e
              ? new Date(new Date(e.starts_at).getTime() + 330 * 60000)
                  .toISOString()
                  .slice(0, 16)
              : ""
          }
        />
      </label>
      <label>
        Venue
        <input name="venue" defaultValue={e?.venue} maxLength={300} />
      </label>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={e?.description}
          maxLength={10000}
          rows={5}
        />
      </label>
      <label>
        Visibility
        <select name="published" defaultValue={String(e?.published || false)}>
          <option value="false">Draft / unpublished</option>
          <option value="true">Published</option>
        </select>
      </label>
      <label>
        <input type="checkbox" name="publish_consent" /> I approve public
        display when visibility is Published.
      </label>
    </>
  );
}
export function EventWorkspace({
  events,
  enabled,
  createId,
  now,
  available,
}: {
  events: StudioEvent[];
  enabled: boolean;
  createId: string;
  now: string;
  available: boolean;
}) {
  const [q, setQ] = useState(""),
    [visibility, setVisibility] = useState("all"),
    [period, setPeriod] = useState("all");
  const filtered = events
    .filter(
      (e) =>
        (visibility === "all" ||
          e.published === (visibility === "published")) &&
        (period === "all" ||
          (period === "upcoming" ? e.starts_at >= now : e.starts_at < now)) &&
        `${e.title} ${e.venue}`.toLowerCase().includes(q.toLowerCase()),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <details className="management-panel studio-card">
        <summary>Create an event</summary>
        <StudioForm kind="event" id={createId} enabled={enabled}>
          <Fields />
        </StudioForm>
      </details>
      <section className="management-panel studio-card">
        <div className="management-filters" role="search">
          <label>
            Title or venue
            <input
              type="search"
              value={q}
              maxLength={120}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
          <label>
            Visibility
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="all">All events</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <label>
            Dates
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </label>
          <button
            type="button"
            className="admin-logout"
            onClick={() => {
              setQ("");
              setVisibility("all");
              setPeriod("all");
            }}
          >
            Reset
          </button>
        </div>
        {available ? (
          <>
            <p>
              {filtered.length} matching{" "}
              {filtered.length === 1 ? "event" : "events"}
            </p>
            {!filtered.length && (
              <p className="management-empty">No events match this view.</p>
            )}
            {filtered.map((e) => (
              <details key={e.id} className="studio-card">
                <summary>
                  {e.title} / {e.published ? "Published" : "Draft"}
                </summary>
                <p>
                  {new Intl.DateTimeFormat("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Kolkata",
                  }).format(new Date(e.starts_at))}{" "}
                  IST
                </p>
                <StudioForm
                  kind="event"
                  id={e.id}
                  version={e.updated_at}
                  enabled={enabled}
                >
                  <Fields event={e} />
                </StudioForm>
              </details>
            ))}
          </>
        ) : (
          <p>
            Event history is unavailable until its approved data source is
            active.
          </p>
        )}
      </section>
    </>
  );
}
