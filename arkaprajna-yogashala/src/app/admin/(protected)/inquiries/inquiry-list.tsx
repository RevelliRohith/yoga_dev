"use client";
import { useState } from "react";
import type { Inquiry } from "@/lib/studio/model";
import { StudioForm } from "../studio-forms";
export function InquiryList({
  records,
  enabled,
}: {
  records: Inquiry[];
  enabled: boolean;
}) {
  const [q, setQ] = useState(""),
    [status, setStatus] = useState("all");
  const filtered = records.filter(
    (i) =>
      (status === "all" || i.status === status) &&
      `${i.full_name} ${i.mobile} ${i.program}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <div className="management-filters">
        <label>
          Name, mobile or program
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {["all", "new", "contacted", "converted", "closed"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button
          className="admin-logout"
          onClick={() => {
            setQ("");
            setStatus("all");
          }}
        >
          Reset
        </button>
      </div>
      {filtered.map((i) => (
        <details key={i.id} className="management-panel studio-card">
          <summary>
            {i.full_name} ✳ {i.status} ✳ {i.created_at.slice(0, 10)}
          </summary>
          <p>
            {i.mobile} ✳ {i.program || "Help choosing a program"} ✳{" "}
            {i.preferred_date || "Date not specified"}
          </p>
          <p>{i.message}</p>
          <StudioForm
            kind="inquiry"
            id={i.id}
            version={i.updated_at}
            enabled={enabled}
          >
            <label>
              Status
              <select name="status" defaultValue={i.status}>
                {["new", "contacted", "converted", "closed"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Follow-up notes
              <textarea name="notes" defaultValue={i.notes} maxLength={4000} />
            </label>
            <p>Marking converted does not automatically register a student.</p>
          </StudioForm>
        </details>
      ))}
      {!filtered.length && (
        <p className="management-empty">No matching inquiries.</p>
      )}
    </>
  );
}
