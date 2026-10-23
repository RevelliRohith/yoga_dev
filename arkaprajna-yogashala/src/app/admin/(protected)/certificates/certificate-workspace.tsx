"use client";
import Link from "next/link";
import { useState } from "react";
import { StudioForm } from "../studio-forms";
import type { Certificate, StudioSettings } from "@/lib/studio/model";
export function CertificateWorkspace({
  records,
  enabled,
  createId,
  today,
  settings,
  available,
}: {
  records: Certificate[];
  enabled: boolean;
  createId: string;
  today: string;
  settings: StudioSettings;
  available: boolean;
}) {
  const [q, setQ] = useState(""),
    [date, setDate] = useState(""),
    [name, setName] = useState(""),
    [title, setTitle] = useState(""),
    [issueDate, setIssueDate] = useState(today),
    [preview, setPreview] = useState(false);
  const filtered = records
    .filter(
      (c) =>
        (!date || c.issue_date === date) &&
        `${c.reference} ${c.participant_name} ${c.title}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => b.issue_date.localeCompare(a.issue_date));
  const possibleDuplicate = records.some(
    (c) =>
      c.participant_name.trim().toLowerCase() === name.trim().toLowerCase() &&
      c.title.trim().toLowerCase() === title.trim().toLowerCase() &&
      c.issue_date === issueDate,
  );
  return (
    <>
      <StudioForm kind="certificate" id={createId} enabled={enabled} allowDraft>
        <h2>Prepare a participation certificate</h2>
        <p>
          {enabled
            ? "Review the draft before explicitly confirming issuance."
            : "You can review an unsaved draft. Issuance remains disabled until the approved database and write activation are available."}
        </p>
        <label>
          Participant name
          <input
            name="participant_name"
            required
            maxLength={150}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <label>
          Event or program title
          <input
            name="title"
            required
            maxLength={200}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        <label>
          Issue date
          <input
            name="issue_date"
            type="date"
            required
            max={today}
            value={issueDate}
            onChange={(e) => {
              setIssueDate(e.target.value);
              setPreview(false);
            }}
          />
        </label>
        {possibleDuplicate && (
          <p role="alert" className="admin-alert">
            A certificate with these details already exists. Review the history
            before issuing another.
          </p>
        )}
        <button
          type="button"
          className="admin-logout"
          disabled={!name.trim() || !title.trim() || !issueDate}
          onClick={() => setPreview(true)}
        >
          Review draft
        </button>
        {preview && (
          <article
            className="certificate-draft no-print"
            aria-label="Unsaved certificate preview"
          >
            <strong>DRAFT - NOT ISSUED</strong>
            <h2>{settings.name}</h2>
            <p>Certificate of participation</p>
            <h3>{name}</h3>
            <p>{title}</p>
            <p>Proposed issue date: {issueDate}</p>
            <p>{settings.certificate_footer}</p>
            <small>
              No reference has been issued. This preview is not an official
              certificate.
            </small>
          </article>
        )}
        <p>
          No accreditation or official affiliation is implied. Only saved,
          issued records have printable references.
        </p>
      </StudioForm>
      <section className="management-panel studio-card">
        <h2>Certificate history</h2>
        {available ? (
          <>
            <div className="management-filters" role="search">
              <label>
                Reference, participant or title
                <input
                  type="search"
                  maxLength={120}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </label>
              <label>
                Issue date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <button
                className="admin-logout"
                onClick={() => {
                  setQ("");
                  setDate("");
                }}
              >
                Reset
              </button>
            </div>
            <div className="management-table-wrap">
              <table className="management-table">
                <caption>Issued participation certificates</caption>
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Participant</th>
                    <th>Event or program</th>
                    <th>Issue date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/admin/certificates/${c.id}`}>
                          {c.reference}
                        </Link>
                      </td>
                      <td>{c.participant_name}</td>
                      <td>{c.title}</td>
                      <td>{c.issue_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && (
              <p className="management-empty">
                No certificates match this view.
              </p>
            )}
          </>
        ) : (
          <p>
            Certificate history is unavailable until its approved data source is
            active.
          </p>
        )}
      </section>
    </>
  );
}
