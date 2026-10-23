"use client";
import { useState } from "react";
export function CopyMessage({ text }: { text: string }) {
  const [state, setState] = useState("");
  return (
    <div className="studio-card">
      <textarea readOnly aria-label="Prepared message" value={text} rows={4} />
      <button
        className="admin-logout"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("Copied for manual review. Nothing was sent.");
          } catch {
            setState("Select and copy the text manually.");
          }
        }}
      >
        Copy message
      </button>
      <span role="status">{state}</span>
    </div>
  );
}
