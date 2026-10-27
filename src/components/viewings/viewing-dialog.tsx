"use client";

import { CalendarCheck, CalendarPlus, CheckCircle2, Loader2, Sparkles, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { bookViewingAction, prepareBookingAction, updateViewingAction } from "@/app/(app)/viewings/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { formatDateTime } from "@/lib/i18n/format";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import type { BookingPrep } from "@/lib/viewings/booking";
import type { Viewing } from "@/lib/viewings/data";
import { calendarMessages, DEFAULT_DURATION, DURATIONS, enableCalendarHref, type CalendarOutcome } from "@/lib/viewings/logic";

export type Booked = { startsAt: string; calendar: CalendarOutcome; clientId: string };

const weekday = new Intl.DateTimeFormat("hu-HU", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
const slotLabel = (local: string) => {
  const utc = zonedLocalToUtc(local);
  return utc ? weekday.format(new Date(utc)) : local;
};

/**
 * Books a viewing (or changes one): client, listing, time, and the agent's
 * Google Calendar with reminders. From an email, the client's proposed times
 * and the listing they asked about are filled in.
 */
export function ViewingDialog(
  props:
    | { mode: "book"; clientId?: string; propertyId?: string; emailId?: string; onBooked?: (b: Booked) => void; onClose: () => void }
    | { mode: "edit"; viewing: Viewing; onClose: () => void },
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const editing = props.mode === "edit" ? props.viewing : null;
  const [prep, setPrep] = useState<BookingPrep | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [clientId, setClientId] = useState("");
  const [newClient, setNewClient] = useState<{ full_name: string; email: string; phone: string } | null>(null);
  const [propertyId, setPropertyId] = useState("");
  const [start, setStart] = useState(editing ? utcToZonedLocal(editing.startsAt) : "");
  const [duration, setDuration] = useState(editing?.durationMinutes ?? DEFAULT_DURATION);
  const [location, setLocation] = useState(editing?.location ?? "");
  const [locationEdited, setLocationEdited] = useState(Boolean(editing));
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [toCalendar, setToCalendar] = useState(true);
  const [invite, setInvite] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ startsAt: string; calendar: CalendarOutcome } | null>(null);

  const book = props.mode === "book" ? props : null;
  useEffect(() => {
    dialog.current?.showModal();
    if (!book) return;
    let cancelled = false;
    prepareBookingAction({ clientId: book.clientId ?? null, propertyId: book.propertyId ?? null, emailId: book.emailId ?? null })
      .then((p) => {
        if (cancelled) return;
        if (!p) return setLoadError("A foglalás előkészítése nem sikerült.");
        setPrep(p);
        setClientId(p.client?.id ?? "");
        if (!p.client && p.inquirer) setNewClient({ full_name: p.inquirer.name, email: p.inquirer.email ?? "", phone: p.inquirer.phone ?? "" });
        setPropertyId(p.propertyId ?? "");
        setLocation(p.properties.find((x) => x.id === p.propertyId)?.location ?? "");
        setStart(p.times[0]);
        setToCalendar(p.calendar.connected);
      })
      .catch(() => !cancelled && setLoadError("A foglalás előkészítése nem sikerült. Próbáld újra."));
    return () => {
      cancelled = true;
    };
    // Prepared once per opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickProperty(id: string) {
    setPropertyId(id);
    if (!locationEdited) setLocation(prep?.properties.find((x) => x.id === id)?.location ?? "");
  }

  const clientEmail = prep?.client?.email ?? (newClient?.email.trim() || null) ?? prep?.clients.find((c) => c.id === clientId)?.email ?? null;
  const hasClient = Boolean(clientId || newClient?.full_name.trim());

  async function save() {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        const r = await updateViewingAction(editing.id, { start, durationMinutes: duration, location, notes });
        if (!r.ok) return setError(r.error);
        setDone({ startsAt: zonedLocalToUtc(start) ?? editing.startsAt, calendar: r.calendar });
        return;
      }
      const r = await bookViewingAction({
        clientId: clientId || null,
        newClient: clientId ? null : newClient && { full_name: newClient.full_name, email: newClient.email, phone: newClient.phone },
        propertyId,
        start,
        durationMinutes: duration,
        location,
        notes,
        addToCalendar: toCalendar,
        inviteClient: toCalendar && invite,
        emailId: book?.emailId ?? null,
      });
      if (!r.ok) return setError(r.error);
      book?.onBooked?.({ startsAt: r.startsAt, calendar: r.calendar, clientId: r.clientId });
      // The Calendar permission is a one-time Google step; the callback adds this viewing.
      if (r.calendar === "needs_permission" && toCalendar) {
        window.location.href = enableCalendarHref(pathname);
        return;
      }
      setDone({ startsAt: r.startsAt, calendar: r.calendar });
    } catch {
      setError("A mentés nem sikerült. Próbáld újra.");
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(start) && (editing || (propertyId && hasClient));
  const calendarNote = done ? calendarMessages[done.calendar] : null;

  return (
    <dialog
      ref={dialog}
      onClose={props.onClose}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-0 text-text shadow-float backdrop:bg-ink/30"
      aria-label={editing ? "Megtekintés módosítása" : "Megtekintés foglalása"}
    >
      <div className="flex max-h-[90dvh] flex-col gap-4 overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">{editing ? "Megtekintés módosítása" : "Megtekintés foglalása"}</h2>
            {editing && (
              <p className="mt-0.5 text-sm text-muted">
                {editing.client.name} · {editing.property.name}
              </p>
            )}
          </div>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Bezárás" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
            <X className="size-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
              <CheckCircle2 className="size-4 shrink-0" /> {editing ? "Módosítva" : "Lefoglalva"}: {formatDateTime(done.startsAt)}
            </p>
            {calendarNote && <p className={done.calendar === "added" || done.calendar === "updated" ? "text-sm text-text" : "text-sm text-warning"}>{calendarNote}</p>}
            {done.calendar === "needs_permission" && (
              <a href={enableCalendarHref(pathname)} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-ink underline-offset-2 hover:underline">
                <CalendarPlus className="size-4" /> Google Naptár engedélyezése
              </a>
            )}
            <p className="text-xs text-muted">A megtekintés után itt kérdezünk rá, hogyan sikerült, és a válasz az ügyfél idővonalára kerül.</p>
            <div>
              <Button onClick={() => dialog.current?.close()}>Kész</Button>
            </div>
          </div>
        ) : !editing && !prep ? (
          loadError ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {loadError}
            </p>
          ) : (
            <p className="flex items-center gap-2 py-8 text-sm text-muted">
              <Loader2 className="size-4 animate-spin text-accent" /> Előkészítem a foglalást…
            </p>
          )
        ) : (
          <>
            {prep && (
              <>
                {prep.client ? (
                  <Field label="Ügyfél" htmlFor="v-client">
                    <Input id="v-client" value={prep.client.name} readOnly className="bg-surface" />
                  </Field>
                ) : newClient ? (
                  <fieldset className="flex flex-col gap-3 rounded-2xl bg-surface p-3">
                    <legend className="sr-only">Új ügyfél</legend>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink">Új ügyfél</p>
                      {prep.clients.length > 0 && (
                        <button type="button" onClick={() => setNewClient(null)} className="text-xs font-medium text-muted hover:text-ink">
                          Meglévő ügyfél választása
                        </button>
                      )}
                    </div>
                    <Field label="Név" htmlFor="v-name">
                      <Input id="v-name" value={newClient.full_name} onChange={(e) => setNewClient({ ...newClient, full_name: e.target.value })} />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="E-mail" htmlFor="v-email">
                        <Input id="v-email" type="email" value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} />
                      </Field>
                      <Field label="Telefon" htmlFor="v-phone">
                        <Input id="v-phone" type="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} />
                      </Field>
                    </div>
                  </fieldset>
                ) : (
                  <Field label="Ügyfél" htmlFor="v-client">
                    <Select
                      id="v-client"
                      value={clientId}
                      onChange={(e) => {
                        if (e.target.value === "__new") {
                          setClientId("");
                          setNewClient({ full_name: prep.inquirer?.name ?? "", email: prep.inquirer?.email ?? "", phone: prep.inquirer?.phone ?? "" });
                        } else setClientId(e.target.value);
                      }}
                    >
                      <option value="">Válassz ügyfelet…</option>
                      {prep.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                          {c.detail ? ` · ${c.detail}` : ""}
                        </option>
                      ))}
                      <option value="__new">+ Új ügyfél…</option>
                    </Select>
                  </Field>
                )}

                <Field label="Ingatlan" htmlFor="v-property">
                  <Select id="v-property" value={propertyId} onChange={(e) => pickProperty(e.target.value)}>
                    <option value="">Válassz ingatlant…</option>
                    {prep.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.detail ? ` · ${p.detail}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}

            {prep?.timesFromEmail && (
              <div className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-xs text-accent">
                  <Sparkles className="size-3.5" /> Az ügyfél ezeket az időpontokat javasolta:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {prep.times.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setStart(t)}
                      aria-pressed={start === t}
                      className={
                        start === t
                          ? "rounded-full bg-ink px-3 py-1 text-xs font-medium text-white"
                          : "rounded-full border border-border-strong px-3 py-1 text-xs font-medium text-ink hover:bg-surface"
                      }
                    >
                      {slotLabel(t)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
              <Field label="Időpont" htmlFor="v-start">
                <Input id="v-start" type="datetime-local" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
              </Field>
              <Field label="Időtartam" htmlFor="v-duration">
                <Select id="v-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} perc
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Helyszín" htmlFor="v-location">
              <Input
                id="v-location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setLocationEdited(true);
                }}
                placeholder="Cím vagy találkozási pont"
              />
            </Field>
            <Field label="Megjegyzés" htmlFor="v-notes">
              <Textarea id="v-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="pl. kapukód, ki nyitja az ajtót" className="min-h-20" />
            </Field>

            {prep &&
              (prep.calendar.connected ? (
                <div className="flex flex-col gap-2 rounded-2xl bg-surface p-3">
                  <label className="flex items-start gap-2 text-sm text-text">
                    <input type="checkbox" checked={toCalendar} onChange={(e) => setToCalendar(e.target.checked)} className="mt-0.5 size-4 accent-[var(--primary)]" />
                    <span>
                      Hozzáadás a Google Naptáradhoz{prep.calendar.email && <span className="text-muted"> ({prep.calendar.email})</span>}, emlékeztetővel előtte egy nappal és egy órával
                      {!prep.calendar.allowed && <span className="block text-xs text-muted">Először egy egyszeri Google-engedélyt kérünk, utána automatikusan bekerül.</span>}
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={invite && toCalendar && Boolean(clientEmail)}
                      disabled={!toCalendar || !clientEmail}
                      onChange={(e) => setInvite(e.target.checked)}
                      className="mt-0.5 size-4 accent-[var(--primary)]"
                    />
                    <span className={!toCalendar || !clientEmail ? "text-muted" : undefined}>
                      Naptármeghívó az ügyfélnek is{clientEmail ? ` (${clientEmail})` : " – nincs e-mail-címe"}
                      <span className="block text-xs text-muted">A meghívót a Google küldi el, módosításkor és lemondáskor is értesíti.</span>
                    </span>
                  </label>
                </div>
              ) : (
                <p className="text-xs text-muted">Ha bekötöd a Gmailt a Levelek oldalon, a megtekintések a Google Naptáradba is bekerülhetnek.</p>
              ))}

            {error && (
              <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => dialog.current?.close()} disabled={busy}>
                Mégse
              </Button>
              <Button onClick={save} disabled={!ready || busy}>
                {busy ? <Loader2 className="animate-spin" /> : <CalendarCheck />} {editing ? "Mentés" : "Megtekintés foglalása"}
              </Button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
