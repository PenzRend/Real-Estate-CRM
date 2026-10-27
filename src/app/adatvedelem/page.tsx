import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell/logo";

// Public privacy policy for the CRM and its import extension (the Chrome Web
// Store and Google's OAuth review both link here). Every statement describes
// what the code does; the controller's details come from the environment.

export const metadata: Metadata = {
  title: { absolute: "Adatkezelési tájékoztató – Flavio" },
  description: "Milyen adatokat kezel a Flavio és az importáló böngészőbővítmény, mire használja, és kinek adja át.",
};

const UPDATED = "2026. október 27.";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h2>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-text">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const controller = process.env.PRIVACY_CONTROLLER || "[Adatkezelő neve és címe – kitöltendő]";
  const contact = process.env.PRIVACY_EMAIL || null;
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-6 sm:px-6">
        <Logo href="/" />
        <Link href="/login" className="text-sm text-muted hover:text-ink">
          Belépés
        </Link>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 pb-20 pt-6 sm:px-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-ink">Adatkezelési tájékoztató</h1>
          <p className="text-sm text-muted">Utolsó módosítás: {UPDATED}</p>
        </div>

        <Section title="Kié az adat, ki kezeli?">
          <p>
            A Flavio ingatlanosoknak készült ügyfélkezelő (CRM). Az adatkezelő: {controller}
            {contact && (
              <>
                , e-mail:{" "}
                <a href={`mailto:${contact}`} className="font-medium text-accent hover:underline">
                  {contact}
                </a>
              </>
            )}
            .
          </p>
          <p>
            Az ügyfelek, ingatlanok és levelek adatait az ingatlanos (a munkaterület) viszi fel; ezekért ő felel, a CRM az ő megbízásából tárolja és dolgozza fel
            őket. Minden munkaterület csak a saját adatait látja.
          </p>
        </Section>

        <Section title="Milyen adatokat kezelünk?">
          <ul className="list-disc pl-5">
            <li>Fiók: név, e-mail-cím, a munkaterület neve.</li>
            <li>Ügyfelek: név, elérhetőség, keresési igények, jegyzetek, megtekintések és visszajelzések, teendők.</li>
            <li>Ingatlanok: a hirdetés adatai, fotók és videólinkek, tulajdonosi adatok, ha az ingatlanos felviszi őket.</li>
            <li>Diktált jegyzetek: a hangfelvételből szöveg lesz; a hangfelvételt nem tároljuk.</li>
            <li>E-mailek és naptár, ha az ingatlanos összekapcsolja a Google-fiókját (lásd lent).</li>
          </ul>
        </Section>

        <Section title="Google-fiók (Gmail és Naptár)">
          <p>Az összekapcsolás önkéntes, és bármikor megszüntethető a Flavio Levelek oldalán (Leválasztás) vagy a Google-fiók biztonsági oldalán. Engedélyenként:</p>
          <ul className="list-disc pl-5">
            <li>
              <b>E-mailek olvasása:</b> a beérkező levelek beolvasása, hogy a Flavio az ügyfelekhez rendelje őket, összefoglalja, és válaszvázlatot írjon.
            </li>
            <li>
              <b>E-mail küldése:</b> csak akkor küld levelet, amikor az ingatlanos a CRM-ben a küldés gombra nyom.
            </li>
            <li>
              <b>Naptár:</b> csak a CRM-ben foglalt megtekintések eseményeit hozza létre, módosítja és törli az ingatlanos naptárában.
            </li>
          </ul>
          <p>
            A Google API-kból kapott adatok felhasználása és átadása megfelel a{" "}
            <a href="https://developers.google.com/terms/api-services-user-data-policy" className="font-medium text-accent hover:underline" rel="noopener noreferrer">
              Google API Services User Data Policy
            </a>{" "}
            előírásainak, a „Limited Use” követelményekkel együtt: csak a fenti funkciókhoz használjuk, nem adjuk el, nem használjuk hirdetésre, és nem
            tanítunk rajtuk általános AI-modelleket.
          </p>
        </Section>

        <Section title="Az importáló böngészőbővítmény">
          <p>A bővítmény az ingatlanos saját hirdetéseit hozza át egy hirdetési portálról a Flavióba.</p>
          <ul className="list-disc pl-5">
            <li>
              Csak akkor olvas egy oldalt, amikor az ingatlanos rákattint a bővítményre, vagy amikor a CRM-ből importálásra nyit meg egy hirdetést. A háttérben,
              ütemezetten vagy más oldalakon nem fut.
            </li>
            <li>Az oldal szövegét, strukturált adatait, a fotók és videók linkjeit olvassa ki, és közvetlenül a Flavio importáló oldalának adja át.</li>
            <li>
              A fotókat csak azokról a képszerverekről tölti le, amelyekhez az ingatlanos engedélyt adott, és a CRM lapjának saját tárolójában tartja őket,
              amíg az ingatlanos el nem menti a hirdetést.
            </li>
            <li>Semmit nem küld harmadik félnek, nem gyűjt böngészési előzményt, és nem tartalmaz hirdetést vagy követőkódot.</li>
          </ul>
        </Section>

        <Section title="Kik dolgoznak az adatokkal?">
          <ul className="list-disc pl-5">
            <li>Supabase: adatbázis, fájltárolás és bejelentkezés.</li>
            <li>A tárhelyszolgáltató, ahol a Flavio fut.</li>
            <li>
              AI-szolgáltató (a beállítástól függően pl. Anthropic vagy egy OpenAI-kompatibilis szolgáltató): az ingatlanos által indított AI-funkciókhoz –
              kitöltés, összefoglaló, válaszvázlat, diktálás – megkapja az ehhez szükséges szöveget. Az eredményt az ingatlanos ellenőrzi, mielőtt bármi mentődne
              vagy elmenne.
            </li>
            <li>Google: csak összekapcsolt fiók esetén, a fenti célokra.</li>
          </ul>
          <p>Adatot nem adunk el, és hirdetési célra nem használunk.</p>
        </Section>

        <Section title="Meddig tároljuk, és milyen jogaid vannak?">
          <p>
            Az adatokat a fiók megszűnéséig tároljuk, vagy amíg az ingatlanos nem törli őket. Kérheted az adataid másolatát, helyesbítését, törlését,
            kezelésének korlátozását, és tiltakozhatsz a kezelésük ellen{contact ? <> a fenti e-mail-címen</> : null}. Ha úgy érzed, jogsértés történt, a
            Nemzeti Adatvédelmi és Információszabadság Hatósághoz (NAIH) fordulhatsz.
          </p>
        </Section>
      </main>
    </div>
  );
}
