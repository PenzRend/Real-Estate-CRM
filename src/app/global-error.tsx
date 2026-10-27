"use client";

import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own <html> and styles. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="hu">
      <body className="grid min-h-dvh place-items-center bg-background px-6 text-center font-sans text-[15px] text-text">
        <div className="flex max-w-sm flex-col items-center gap-3">
          <h1 className="text-[28px] leading-tight text-ink">Valami nem sikerült</h1>
          <p className="text-muted">Az adataid biztonságban vannak. Próbáld újra egy kicsit később.</p>
          <button type="button" onClick={() => retry()} className="mt-3 h-11 rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
            Újrapróbálás
          </button>
        </div>
      </body>
    </html>
  );
}
