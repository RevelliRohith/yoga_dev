export default function Loading() {
  return (
    <section className="management-empty" aria-live="polite" aria-busy="true">
      <h2>Loading your workspace...</h2>
      <p>Verifying access and retrieving current studio records.</p>
    </section>
  );
}
