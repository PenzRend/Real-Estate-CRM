import Link from "next/link";

export function Logo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 text-ink" aria-label="Flavio – kezdőlap">
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-white">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
          <path d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 10v9h10v-9" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[17px] font-medium tracking-[-0.04em]">flavio</span>
    </Link>
  );
}
