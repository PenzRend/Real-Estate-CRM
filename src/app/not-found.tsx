import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Nem található" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <p className="text-sm text-subtle tabular-nums">404</p>
        <h1 className="text-[28px] leading-tight">Ez az oldal nem található</h1>
        <p className="text-muted">Lehet, hogy elírták a címet, vagy a link már nem érvényes.</p>
        <Link href="/" className="mt-3 inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-white hover:bg-primary-hover">
          A Flavio főoldalára
        </Link>
      </div>
    </main>
  );
}
