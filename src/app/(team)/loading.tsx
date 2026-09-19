export default function Loading() {
  return (
    <div className="loading-state" role="status" aria-label="Laster inn">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
      <span className="sr-only">Laster inn …</span>
    </div>
  );
}
