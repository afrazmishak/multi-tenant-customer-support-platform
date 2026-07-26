export default function FullPageLoader({
  message = "Loading...",
}) {
  return (
    <main className="full-page-state">
      <div
        className="spinner"
        aria-hidden="true"
      />

      <p>{message}</p>
    </main>
  );
}