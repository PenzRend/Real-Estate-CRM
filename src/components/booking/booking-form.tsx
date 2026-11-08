"use client";

import { CalendarCheck, Check, Loader2, MapPin } from "lucide-react";
import { useState, useTransition } from "react";
import { bookViewingPublicAction } from "@/app/b/[token]/actions";
import type { BookingListing } from "@/lib/booking/data";
import type { SlotDay } from "@/lib/booking/slots";
import { cn } from "@/lib/cn";

const dayLabel = new Intl.DateTimeFormat("hu-HU", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const longWhen = new Intl.DateTimeFormat("hu-HU", { weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
const price = (l: BookingListing) =>
  l.price == null ? null : `${new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 }).format(l.price / 1_000_000)} M ${l.currency === "EUR" ? "€" : "Ft"}${l.rent ? " / hó" : ""}`;

/** The client picks a listing, a day and a time, and leaves a name and a phone number. */
export function BookingForm({ token, listings, days, initialListing, agent }: { token: string; listings: BookingListing[]; days: SlotDay[]; initialListing: string | null; agent: string }) {
  const [listing, setListing] = useState(listings.some((l) => l.id === initialListing) ? initialListing! : listings.length === 1 ? listings[0].id : "");
  const [day, setDay] = useState(days[0]?.date ?? "");
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ title: string; when: string } | null>(null);
  const [busy, start] = useTransition();
  const chosen = listings.find((l) => l.id === listing);
  const field = "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-[15px] text-ink focus:border-ink focus:outline-none";

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-success/30 bg-success-soft/40 px-6 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success text-white">
          <Check className="size-6" />
        </span>
        <p className="text-xl font-medium text-ink">Lefoglalva!</p>
        <p className="max-w-sm text-[15px] text-text">
          {done.title}
          <br />
          <span className="font-medium">{done.when}</span>
        </p>
        <p className="max-w-sm text-sm text-muted">{agent} megkapta a foglalást. Ha közbejön valami, hívd fel vagy írj neki.</p>
      </div>
    );
  }

  if (!listings.length) return <p className="rounded-3xl border border-border px-6 py-10 text-center text-muted">Most nincs foglalható ingatlan. Hívd az ingatlanost.</p>;

  const slots = days.find((d) => d.date === day)?.slots ?? [];
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!listing || !slot) return setError("Válassz ingatlant és időpontot.");
        setError(null);
        start(async () => {
          const r = await bookViewingPublicAction(token, { propertyId: listing, start: slot, name, phone, email, note }).catch(() => ({ ok: false as const, error: "A foglalás most nem sikerült. Próbáld újra." }));
          if (!r.ok) {
            setError(r.error);
            return;
          }
          setDone({ title: r.title || chosen?.title || "", when: longWhen.format(new Date(slot)) });
        });
      }}
    >
      {listings.length > 1 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-ink">Melyik ingatlant néznéd meg?</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {listings.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setListing(l.id)}
                className={cn("flex flex-col items-start gap-0.5 rounded-2xl border px-4 py-3 text-left transition-colors", listing === l.id ? "border-ink bg-ink text-white" : "border-border hover:bg-surface")}
              >
                <span className="text-sm font-medium">{l.title}</span>
                <span className={cn("text-xs", listing === l.id ? "text-white/70" : "text-muted")}>{[l.place, price(l)].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {listings.length === 1 && chosen && (
        <p className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 text-sm text-ink">
          <MapPin className="size-4 text-muted" /> {chosen.title}
          {chosen.place && <span className="text-muted">· {chosen.place}</span>}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-ink">Mikor?</h2>
        {days.length ? (
          <>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => {
                    setDay(d.date);
                    setSlot(null);
                  }}
                  className={cn("shrink-0 rounded-xl border px-3.5 py-2 text-sm capitalize transition-colors", day === d.date ? "border-ink bg-ink text-white" : "border-border hover:bg-surface")}
                >
                  {dayLabel.format(new Date(`${d.date}T12:00:00Z`))}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => setSlot(s.start)}
                  className={cn("rounded-xl border py-2.5 text-sm tabular-nums transition-colors", slot === s.start ? "border-accent bg-accent text-white" : "border-border hover:bg-surface")}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">A következő napokban nincs szabad időpont. Hívd az ingatlanost.</p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Neved
          <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Telefonszám
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" autoComplete="tel" placeholder="+36 30 123 4567" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          E-mail (ha nincs telefon)
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted sm:col-span-2">
          Megjegyzés (nem kötelező)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Pl. ketten jövünk, parkolni hol lehet?" className={field} />
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !slot || !listing} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-medium text-white hover:bg-primary-hover disabled:opacity-40">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />} {slot ? `Foglalás: ${longWhen.format(new Date(slot))}` : "Válassz időpontot"}
      </button>
      <p className="text-center text-xs text-subtle">A neved és az elérhetőséged csak az ingatlanos látja, a megtekintés egyeztetéséhez.</p>
    </form>
  );
}
