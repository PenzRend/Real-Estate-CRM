export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-4" aria-busy="true" aria-label="Betöltés">
      <div className="h-9 w-48 rounded-lg bg-surface-strong" />
      <div className="h-4 w-64 rounded bg-surface" />
      <div className="mt-6 h-11 rounded-xl bg-surface" />
      <div className="h-11 rounded-xl bg-surface" />
      <div className="h-12 rounded-full bg-surface-strong" />
    </div>
  );
}
