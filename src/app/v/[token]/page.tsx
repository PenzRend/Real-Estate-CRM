import { CalendarClock, Check, MapPin, X } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Logo } from "@/components/app-shell/logo";
import { FormSubmit } from "@/components/ui/form-submit";
import { buttonClasses } from "@/components/ui/button";
import { DEFAULT_TIMEZONE } from "@/lib/i18n/format";
import { hashSecretToken, SECRET_TOKEN } from "@/lib/secret-token";
import { createClient } from "@/lib/supabase/server";
import { mapsUrl } from "@/lib/viewings/reminder";
import { respondAction } from "./actions";

// The page a client opens from the day-before reminder: the viewing's time and
// place, and two buttons. No sign-in, no CRM: the link itself is the key, and
// answering takes a deliberate click (mail scanners only open links).

export const metadata: Metadata = { title: { absolute: "Megtekintés" }, robots: { index: false, follow: false } };

type Row = {
  starts_at: string;
  duration_minutes: number;
  status: string;
  location: string | null;
  property_title: string;
  property_address: string | null;
  client_name: string;
  agent_name: string;
  client_response: "confirmed" | "declined" | null;
};

async function Viewing({ params }: Pick<PageProps<"/v/[token]">, "params">) {
  await connection();
  const { token } = await params;
  const supabase = await createClient();
  const { data } = SECRET_TOKEN.test(token) ? await supabase.rpc("viewing_for_client", { p_token_hash: hashSecretToken(token) }) : { data: null };
  const v = (data as Row[] | null)?.[0];
  if (!v) {
    return (
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl">Ez a link már nem érvényes</h1>
        <p className="text-muted">Lehet, hogy az időpont megváltozott, és új emlékeztető ment ki. Ha kérdése van, keresse az ingatlanosát.</p>
      </div>
    );
  }
  const at = new Date(v.starts_at);
  const day = new Intl.DateTimeFormat("hu-HU", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: DEFAULT_TIMEZONE }).format(at);
  const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: DEFAULT_TIMEZONE }).format(at);
  const place = v.location || v.property_address;
  const over = v.status !== "scheduled" || at.getTime() < new Date().getTime() - 2 * 3600_000;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted">Kedves {v.client_name}!</p>
        <h1 className="mt-1 text-[26px] leading-tight">Megtekintés: {v.property_title}</h1>
      </div>
      <dl className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 size-5 shrink-0 text-muted" />
          <div>
            <dt className="sr-only">Időpont</dt>
            <dd className="font-medium text-ink">{day}</dd>
            <dd className="text-muted">
              {time} · kb. {v.duration_minutes} perc
            </dd>
          </div>
        </div>
        {place && (
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-muted" />
            <div>
              <dt className="sr-only">Helyszín</dt>
              <dd className="font-medium text-ink">{place}</dd>
              <dd>
                <a href={mapsUrl(place)} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline-offset-2 hover:underline">
                  Megnyitás térképen
                </a>
              </dd>
            </div>
          </div>
        )}
      </dl>

      {over ? (
        <p className="text-muted">Ez a megtekintés már lezajlott vagy módosult.</p>
      ) : v.client_response ? (
        <div className={v.client_response === "confirmed" ? "rounded-2xl bg-success-soft p-4 text-success" : "rounded-2xl bg-surface p-4 text-text"}>
          <p className="font-medium">{v.client_response === "confirmed" ? "Köszönöm, számítok Önre!" : "Köszönöm, hogy jelezte. Hamarosan keresem egy új időponttal."}</p>
          <p className="mt-1 text-sm opacity-80">Ha mégis változna, itt módosíthatja:</p>
        </div>
      ) : (
        <p className="text-text">Kérem, jelezze, hogy számíthatok-e Önre:</p>
      )}

      {!over && (
        <form className="flex flex-col gap-3">
          <input name="note" maxLength={500} placeholder="Üzenet (nem kötelező), pl. 5 percet késem" aria-label="Üzenet" className="h-12 rounded-xl border border-border-strong bg-background px-4 text-[15px] focus:border-ink focus:outline-none" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormSubmit formAction={respondAction.bind(null, token, "confirmed")} className={buttonClasses("primary", "lg", "w-full")}>
              <Check /> Ott leszek
            </FormSubmit>
            <FormSubmit formAction={respondAction.bind(null, token, "declined")} className={buttonClasses("secondary", "lg", "w-full")}>
              <X /> Nem tudok jönni
            </FormSubmit>
          </div>
        </form>
      )}
      <p className="text-sm text-muted">Üdvözlettel: {v.agent_name}</p>
    </div>
  );
}

export default function ViewingResponsePage({ params }: PageProps<"/v/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-5 py-10">
      <Logo href="/" />
      <Suspense fallback={<div className="h-64 shimmer rounded-2xl bg-surface" />}>
        <Viewing params={params} />
      </Suspense>
    </main>
  );
}
