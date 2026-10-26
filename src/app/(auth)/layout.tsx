import { Logo } from "@/components/app-shell/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Logo href="/login" />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted">Az adataidat csak a saját munkaterületed tagjai látják.</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-surface lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-border-strong bg-background px-2 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
            <span aria-hidden className="text-subtle">›</span>
            Ingatlanosoknak készült
          </span>
          <p className="mt-6 text-[44px] leading-[1.05] font-medium tracking-[-0.05em] text-ink">
            Kevesebb adminisztráció.{" "}
            <span className="relative whitespace-nowrap text-subtle">
              Több
              <svg
                viewBox="0 0 120 12"
                preserveAspectRatio="none"
                className="absolute -bottom-2 left-0 h-3 w-full text-subtle"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path d="M2 8c30-6 70-7 116-2M30 10c20-2 45-3 70-1" strokeLinecap="round" />
              </svg>
            </span>{" "}
            lezárt üzlet.
          </p>
          <p className="mt-6 max-w-md text-muted">
            Ügyfelek, ingatlanok, hívásjegyzetek és utánkövetés egy helyen. Az AI-asszisztens rendszerezi a
            jegyzeteidet, és szól, kivel kell ma beszélned.
          </p>

          <ul className="mt-10 grid gap-3">
            {[
              ["01", "Hívásjegyzetből strukturált ügyféladat", "Te ellenőrzöd, mielőtt bármi mentésre kerül."],
              ["02", "Ügyfél–ingatlan párosítás indoklással", "Látod, melyik feltétel teljesül és melyik nem."],
              ["03", "Utánkövetés, ami nem csúszik el", "Mai és lejárt teendők egy pillantással."],
            ].map(([n, title, text]) => (
              <li key={n} className="flex gap-4 rounded-2xl border border-border bg-background p-4 shadow-float">
                <span className="text-sm text-subtle tabular-nums">/ {n}</span>
                <span>
                  <span className="block text-sm font-medium text-ink">{title}</span>
                  <span className="block text-sm text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
