import { Check, Mail, MapPin, Phone, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { SharedGallery } from "@/components/shares/shared-gallery";
import { formatArea, formatNumber, formatPrice } from "@/lib/i18n/format";
import { listingTypeLabels, propertyStatusLabels, propertyTypeLabels } from "@/lib/i18n/labels";
import { EXTRAS, extrasForDisplay } from "@/lib/properties/extras";
import { getSharedListing, type SharedListing } from "@/lib/shares/public";

// The listing page an agent shares with clients: no sign-in, no CRM chrome,
// only what the agent chose to show. Not indexed by search engines.

export async function generateMetadata({ params }: PageProps<"/l/[token]">): Promise<Metadata> {
  const { token } = await params;
  const listing = await getSharedListing(token);
  if (!listing) return { title: { absolute: "Hirdetés" }, robots: { index: false, follow: false } };
  const summary = [formatPrice(listing.price, listing.currency), listing.areaSqm ? formatArea(listing.areaSqm) : null, place(listing)].filter(Boolean).join(" · ");
  return {
    title: { absolute: listing.title },
    description: summary,
    robots: { index: false, follow: false },
    openGraph: { title: listing.title, description: summary, images: listing.previewImage ? [listing.previewImage] : undefined, type: "website" },
  };
}

const place = (l: SharedListing) => [l.postalCode, l.city, l.district].filter(Boolean).join(" ");

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-surface px-4 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-[15px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function ContactCard({ listing }: { listing: SharedListing }) {
  const c = listing.contact;
  const subject = encodeURIComponent(`Érdeklődés: ${listing.title}`);
  return (
    <aside id="kapcsolat" className="flex flex-col gap-4 rounded-3xl border border-border bg-background p-6 shadow-float lg:sticky lg:top-6">
      <div>
        <p className="text-xs tracking-wide text-muted uppercase">Kapcsolat</p>
        <p className="mt-1 text-lg font-medium text-ink">{c.name ?? listing.agency ?? "Ingatlanközvetítő"}</p>
        {/* Personal workspaces are named after the agent: don't say the name twice. */}
        {c.name && listing.agency && listing.agency !== c.name && <p className="text-sm text-muted">{listing.agency}</p>}
      </div>
      <div className="flex flex-col gap-2">
        {c.phone && (
          <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-[15px] font-medium text-white hover:bg-primary-hover">
            <Phone className="size-4" /> {c.phone}
          </a>
        )}
        {c.email && (
          <a
            href={`mailto:${c.email}?subject=${subject}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border-strong px-6 text-[15px] font-medium text-ink hover:bg-surface"
          >
            <Mail className="size-4" /> E-mail küldése
          </a>
        )}
      </div>
      <p className="text-xs text-muted">Kérdése van, vagy megnézné? Hívjon, vagy írjon, és egyeztetünk egy időpontot.</p>
    </aside>
  );
}

async function SharedListingContent({ params }: Pick<PageProps<"/l/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const listing = await getSharedListing(token);

  if (!listing) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-2xl">Ez a hirdetés már nem érhető el</h1>
          <p className="mt-3 text-muted">Lehet, hogy elkelt, vagy a link lejárt. Kérdezze az ingatlanközvetítőt, akitől a linket kapta.</p>
        </div>
      </main>
    );
  }

  const l = listing;
  const yes = (v: unknown) => v === true;
  const amenities = [
    yes(l.hasBalcony) && "Erkély / terasz",
    yes(l.hasGarden) && "Kert",
    yes(l.hasParking) && "Parkolás",
    ...EXTRAS.filter((e) => e.kind === "flag" && yes(l.features[e.key])).map((e) => e.label),
  ].filter(Boolean) as string[];
  const otherFacts = extrasForDisplay(l.features).filter((x) => !EXTRAS.some((e) => e.kind === "flag" && e.label === x.label));
  const videos = Array.isArray(l.features.video_links) ? (l.features.video_links as unknown[]).filter((v): v is string => typeof v === "string" && v.startsWith("https://")) : [];
  const unavailable = ["sold", "rented", "inactive"].includes(l.status);
  const pricePerSqm = l.price != null && l.areaSqm ? `${formatPrice(Math.round(l.price / l.areaSqm), l.currency)} / m²` : null;

  return (
    <div className="min-h-dvh bg-background pb-24 lg:pb-0">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <p className="text-[15px] font-medium tracking-[-0.03em] text-ink">{l.agency ?? "Ingatlan"}</p>
        <a href="#kapcsolat" className="rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
          Kapcsolat
        </a>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:px-6">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {listingTypeLabels[l.listingType]} {propertyTypeLabels[l.propertyType as keyof typeof propertyTypeLabels]?.toLowerCase() ?? ""}
          </p>
          <h1 className="text-[30px] leading-tight sm:text-[42px] sm:tracking-[-0.04em]">{l.title}</h1>
          <p className="flex items-center gap-1.5 text-muted">
            <MapPin className="size-4" /> {[l.address, place(l)].filter(Boolean).join(", ") || "Helyszín egyeztetés szerint"}
          </p>
          {unavailable && (
            <p className="w-fit rounded-full bg-surface-strong px-3 py-1 text-sm text-text">
              {propertyStatusLabels[l.status as keyof typeof propertyStatusLabels]} – kérdezzen hasonló ajánlatokról.
            </p>
          )}
        </div>

        <SharedGallery items={l.media} />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-10">
            <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-8">
              <div>
                <p className="text-[34px] leading-none font-medium tracking-[-0.04em] text-ink tabular-nums sm:text-[44px]">
                  {formatPrice(l.price, l.currency)}
                  {l.listingType === "rent" && l.price != null && <span className="text-lg font-normal text-muted"> / hó</span>}
                </p>
                {pricePerSqm && l.listingType === "sale" && <p className="mt-2 text-sm text-muted">{pricePerSqm}</p>}
              </div>
              <div className="flex gap-6 text-ink">
                {l.areaSqm != null && (
                  <div>
                    <p className="text-2xl font-medium tabular-nums">{formatNumber(l.areaSqm)}</p>
                    <p className="text-xs text-muted">m²</p>
                  </div>
                )}
                {l.roomCount != null && (
                  <div>
                    <p className="text-2xl font-medium tabular-nums">{formatNumber(l.roomCount)}</p>
                    <p className="text-xs text-muted">szoba</p>
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-xl">Az ingatlan adatai</h2>
              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Fact label="Alapterület" value={l.areaSqm != null ? formatArea(l.areaSqm) : null} />
                <Fact label="Szobák" value={l.roomCount != null ? formatNumber(l.roomCount) : null} />
                <Fact label="Hálószobák" value={l.bedroomCount != null ? formatNumber(l.bedroomCount) : null} />
                <Fact label="Fürdőszobák" value={l.bathroomCount != null ? formatNumber(l.bathroomCount) : null} />
                <Fact label="Emelet" value={l.floor} />
                <Fact label="Épület" value={l.buildingType} />
                <Fact label="Állapot" value={l.condition} />
                <Fact label="Energetika" value={l.energyRating} />
                {otherFacts.map((x) => (
                  <Fact key={x.label} label={x.label} value={x.value} />
                ))}
              </dl>
              {amenities.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <li key={a} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink">
                      <Check className="size-3.5 text-success" /> {a}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {l.description && (
              <section>
                <h2 className="text-xl">Leírás</h2>
                <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-line text-text">{l.description}</p>
              </section>
            )}

            {videos.length > 0 && (
              <section className="flex flex-wrap gap-2">
                {videos.map((v) => (
                  <a key={v} href={v} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-border-strong px-4 py-2 text-sm font-medium text-ink hover:bg-surface">
                    <PlayCircle className="size-4" /> {/matterport|kuula/.test(v) ? "Virtuális séta" : "Videó megtekintése"}
                  </a>
                ))}
              </section>
            )}
          </div>

          <ContactCard listing={l} />
        </div>
      </main>

      <footer className="mx-auto mt-16 max-w-6xl border-t border-border px-4 py-6 text-xs text-subtle sm:px-6">
        A hirdetés adatai tájékoztató jellegűek. · Flavio
      </footer>

      {/* Phones: calling or writing is always one tap away. */}
      {(l.contact.phone || l.contact.email) && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
          {l.contact.phone && (
            <a href={`tel:${l.contact.phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-white">
              <Phone className="size-4" /> Hívás
            </a>
          )}
          {l.contact.email && (
            <a href={`mailto:${l.contact.email}?subject=${encodeURIComponent(`Érdeklődés: ${l.title}`)}`} className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-border-strong text-[15px] font-medium text-ink">
              <Mail className="size-4" /> E-mail
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function SharedListingPage({ params }: PageProps<"/l/[token]">) {
  return (
    <Suspense fallback={<div className="min-h-dvh" />}>
      <SharedListingContent params={params} />
    </Suspense>
  );
}
