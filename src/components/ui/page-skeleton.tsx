// Placeholder while per-request page content streams in.
export function PageSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-8" aria-busy="true" aria-label="Betöltés">
      <div className="flex flex-col gap-3">
        <div className="h-6 w-32 rounded-md bg-surface" />
        <div className="h-9 w-64 rounded-lg bg-surface-strong" />
        <div className="h-4 w-96 max-w-full rounded bg-surface" />
      </div>
      <div className="h-32 rounded-2xl bg-surface" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-64 rounded-2xl bg-surface xl:col-span-2" />
        <div className="h-64 rounded-2xl bg-surface" />
      </div>
    </div>
  );
}
