import { Suspense, ViewTransition, type ReactNode } from "react";

/** Placeholder rows while a list loads. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="shimmer rounded-2xl border border-border" aria-busy="true" aria-label="Betöltés">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 border-b border-border px-5 py-4 last:border-b-0">
          <div className="h-3.5 rounded bg-surface-strong" style={{ width: `${35 + ((i * 17) % 30)}%` }} />
          <div className="h-3 rounded bg-surface" style={{ width: `${55 + ((i * 23) % 35)}%` }} />
        </div>
      ))}
    </div>
  );
}

/**
 * The part of a page that changes with its tabs and filters (the page.tsx
 * under a layout that holds the header, tabs and filters). Only this area
 * loads: the old content fades out, a skeleton stands in if the new one takes
 * a moment, and the new content rises in.
 */
export function ListSuspense({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="skeleton-exit" default="none">
          <div>{fallback ?? <ListSkeleton />}</div>
        </ViewTransition>
      }
    >
      <ViewTransition enter="content-enter" exit="list-exit" default="none">
        <div data-list-content>{children}</div>
      </ViewTransition>
    </Suspense>
  );
}

/** A layout's content that stays while its pages change: it fades in once, when the page is first opened. */
export function PageTransition({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div className={className}>{children}</div>
    </ViewTransition>
  );
}
