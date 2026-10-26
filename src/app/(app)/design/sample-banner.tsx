import Link from "next/link";

export function SampleDataBanner() {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary px-5 py-3 text-sm text-white">
      <p>
        <span className="font-medium">Dizájn-előnézet</span>
        <span className="text-white/70"> · kitalált mintaadatokkal, nem valódi ügyfelek</span>
      </p>
      <nav className="flex gap-1">
        {[
          ["/design", "Áttekintés"],
          ["/design/client", "Ügyféladatlap"],
          ["/design/clients", "Ügyféllista"],
        ].map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full px-3 py-1 text-white/80 hover:bg-white/10 hover:text-white">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
