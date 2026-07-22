/** Instant skeleton shown while a route's data resolves — feels snappier than a spinner. */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden>
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-surface-2" />
          <div className="h-3 w-32 rounded bg-surface" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-surface-2" />
      </div>
      <div className="mb-4 h-16 rounded-lg bg-surface" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-surface" />
        ))}
      </div>
      <div className="mt-4 h-64 rounded-lg bg-surface" />
    </div>
  );
}
