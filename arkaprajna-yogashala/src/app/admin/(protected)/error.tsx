"use client";
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return (
    <section className="management-empty" role="alert">
      <h2>This workspace could not be loaded.</h2>
      <p>
        No operation is assumed successful. Review the current records before
        retrying.
      </p>
      <button className="admin-button" onClick={() => reset()}>
        Try again
      </button>
    </section>
  );
}
