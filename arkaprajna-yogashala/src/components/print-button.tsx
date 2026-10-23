"use client";
export function PrintButton() {
  return (
    <button
      type="button"
      className="admin-button no-print"
      onClick={() => window.print()}
    >
      Print / save as PDF
    </button>
  );
}
