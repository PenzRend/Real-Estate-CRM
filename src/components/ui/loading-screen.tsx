/**
 * Between pages, until the new page's content is ready: the Flavio mark
 * drawing its house, breathing gently. It fades in only after a short pause,
 * so a page that loads at once never flashes it (styles in globals.css).
 */
export function LoadingScreen() {
  return (
    <div className="loading-screen grid min-h-[60dvh] place-items-center" role="status" aria-label="Betöltés">
      <div className="flex flex-col items-center gap-4">
        <span className="loading-mark grid size-14 place-items-center rounded-2xl bg-primary text-white shadow-float">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path pathLength={1} className="loading-roof" d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
            <path pathLength={1} className="loading-walls" d="M7 10v9h10v-9" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[17px] font-medium tracking-[-0.04em] text-ink">flavio</span>
        <span className="loading-dots flex gap-1.5" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}
