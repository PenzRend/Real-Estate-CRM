import {
  ArrowRight,
  BellRing,
  Building2,
  Inbox,
  Lock,
  MessageSquareQuote,
  Mic,
  PhoneCall,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell/logo";
import { AssistantMock, CaptureMock, MatchMock } from "@/components/landing/mockups";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";

// Public landing page. Signed-in visitors are sent to the dashboard by the proxy.
// Every claim here describes a working feature; unfinished ones say "Hamarosan".

export const metadata: Metadata = {
  title: { absolute: "Flavio – AI-asszisztens ingatlanosoknak" },
  description:
    "Mondd el a hívást, az AI kitölti az ügyféladatot. Párosítás indoklással, utánkövetés, Gmail-integráció és forrásokkal válaszoló AI-asszisztens – magyarul.",
};

const SIGNUP = "/signup";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
      <span aria-hidden className="text-subtle">›</span>
      {children}
    </span>
  );
}

function Scribble({ children }: { children: ReactNode }) {
  return (
    <span className="relative inline-block whitespace-nowrap text-subtle">
      {children}
      <svg
        viewBox="0 0 120 12"
        preserveAspectRatio="none"
        className="absolute -bottom-1 left-0 h-3 w-full text-subtle"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M2 8c30-6 70-7 116-2M30 10c20-2 45-3 70-1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Tilted icon tile floating beside the hero heading. */
function FloatTile({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "landing-float absolute hidden size-14 place-items-center rounded-2xl border border-border bg-background shadow-float lg:grid",
        className,
      )}
    >
      {children}
    </span>
  );
}

function CtaButtons({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      <ButtonLink href={SIGNUP} size="lg" variant={dark ? "secondary" : "primary"} className={cn("w-full sm:w-auto", dark && "border-transparent")}>
        Kipróbálom ingyen <ArrowRight />
      </ButtonLink>
      <a
        href="#hogyan"
        className={cn("group inline-flex h-12 items-center gap-1.5 px-2 text-[15px] font-medium", dark ? "text-white/80 hover:text-white" : "text-ink hover:text-accent")}
      >
        Hogyan működik?
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </a>
    </div>
  );
}

const features = [
  {
    icon: Mic,
    title: "Mondd el, és kész az ügyféladat",
    text: "Hívás vagy megtekintés után diktálj, vagy tölts fel hangfelvételt. Az AI kiszedi a nevet, a keresést, a keretet és a teendőket – kedden, holnapután is jó dátumra.",
  },
  {
    icon: UserRoundCheck,
    title: "Semmi nem mentődik a tudtod nélkül",
    text: "Az AI csak javasol. Mezőnként látod, mi változna, és te döntöd el, mi kerül be. Meglévő adatot sosem ír felül csendben.",
  },
  {
    icon: ScanSearch,
    title: "Párosítás, ami megmondja, miért",
    text: "Minden ügyfélhez látod az illő ingatlanokat, feltételenként: mi teljesül, mi majdnem, mi nem, és miről nincs adat. Egy kattintással feladat lesz belőle.",
  },
  {
    icon: Inbox,
    title: "A portálos megkeresések maguktól jönnek",
    text: "Kösd be a Gmailt: az ügyfeleid levelei és az ingatlanportálos érdeklődések bekerülnek, a hírleveleket és árfigyelőket kiszűrjük. Egy kattintás, és új ügyfél.",
  },
  {
    icon: MessageSquareQuote,
    title: "Kérdezz, és forrással válaszol",
    text: "„Kiket kell ma visszahívnom?” „Mi illik Annához?” Az asszisztens csak a CRM adataiból válaszol, és minden állítás mellé odateszi, honnan tudja.",
  },
  {
    icon: BellRing,
    title: "Utánkövetés, ami nem csúszik el",
    text: "Mai és lejárt teendők, esedékes visszahívások egy helyen. Reggel megnyitod, és tudod, kivel kell beszélned.",
  },
];

const steps = [
  { title: "Regisztrálj", text: "Egy perc, bankkártya nélkül. Saját, zárt munkaterületet kapsz." },
  { title: "Rögzíts egy hívást", text: "Mondd el, mi történt. Az AI kitölti, te jóváhagyod – az ügyfél és a teendő már bent is van." },
  { title: "Hagyd, hogy dolgozzon", text: "Párosítás, utánkövetés, levelek és válaszok – te pedig a tárgyalásra figyelhetsz." },
];

const roadmap = [
  { icon: PhoneCall, title: "Automatikus hívásrögzítés", text: "Androidos alkalmazás: a hívás után magától átirat és összefoglaló." },
  { icon: Inbox, title: "Outlook-postafiók", text: "A Gmail mellett Microsoft-fiókok bekötése." },
  { icon: Building2, title: "Hirdetések a portálokról", text: "Ingatlanok átvétele hirdetési portálokról kézi gépelés helyett." },
];

const faqs = [
  {
    q: "Kik látják az adataimat?",
    a: "Csak a munkaterületed tagjai. Minden adatsor munkaterülethez kötött, és ezt maga az adatbázis kényszeríti ki, nem csak az alkalmazás.",
  },
  {
    q: "Mit kap meg az AI a hívásaimból?",
    a: "Csak azt a szöveget vagy felvételt, amit te rögzítesz, és csak a feldolgozáshoz. Az AI javaslatát te hagyod jóvá, mielőtt bármi mentésre kerül.",
  },
  {
    q: "Olvassa vagy küldi a leveleimet?",
    a: "Olvassa, és csak a releváns leveleket tárolja: az ügyfeleidtől érkezőket és a portálos megkereséseket. Küldeni csak akkor tud, ha ezt külön engedélyezed, és akkor is csak a te kattintásodra – magától soha. Törölni vagy módosítani nem tud, a postafiók bármikor leválasztható.",
  },
  {
    q: "Kitalálhat valamit az AI-asszisztens?",
    a: "Úgy építettük, hogy ne tegye: csak a CRM-ből lekért adatokból válaszolhat, minden állítás mellé forrást tesz, és ha nincs adat, megmondja.",
  },
  {
    q: "Mennyibe kerül?",
    a: "A regisztráció ingyenes, bankkártya nem kell. Az előfizetési csomagokról időben, előre szólunk.",
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-x-clip">
      {/* Navigation */}
      <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-border bg-background/85 py-2 pr-2 pl-4 backdrop-blur">
          <Logo href="/" />
          <nav className="hidden items-center gap-1 text-[12px] font-medium tracking-wide text-text uppercase md:flex">
            {[
              ["#funkciok", "Funkciók"],
              ["#hogyan", "Hogyan működik"],
              ["#biztonsag", "Biztonság"],
              ["#gyik", "GYIK"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 hover:bg-surface">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-sm font-medium text-ink hover:bg-surface sm:inline-flex">
              Belépés
            </Link>
            <ButtonLink href={SIGNUP} size="sm" className="h-9 px-4">
              Kipróbálom
            </ButtonLink>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <FloatTile className="top-36 left-[6%] -rotate-12 text-accent">
            <Mic className="size-6" />
          </FloatTile>
          <FloatTile className="top-28 right-[7%] rotate-12 text-success [animation-delay:-2s]">
            <ScanSearch className="size-6" />
          </FloatTile>
          <FloatTile className="top-[26rem] left-[10%] -rotate-6 text-ink [animation-delay:-4s]">
            <BellRing className="size-6" />
          </FloatTile>

          <Eyebrow>AI-alapú CRM magyar ingatlanosoknak</Eyebrow>
          <h1 className="mx-auto mt-6 max-w-4xl text-[40px] leading-[1.04] tracking-[-0.05em] sm:text-[64px] lg:text-[76px]">
            Te tárgyalsz. <br className="hidden sm:block" />
            Az <Scribble>adminisztráció</Scribble> megcsinálja magát.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[17px] text-muted">
            Mondd el a hívást, és az AI kitölti az ügyféladatot, felveszi a teendőt, és megmutatja, melyik ingatlan illik
            hozzá – indoklással. Te csak jóváhagyod.
          </p>
          <div className="mt-9">
            <CtaButtons />
          </div>
          <p className="mt-4 text-[13px] text-muted">Ingyenes regisztráció · Bankkártya nélkül · 1 perc</p>

          {/* Product preview */}
          <div className="relative mx-auto mt-16 grid max-w-5xl items-start gap-4 text-left md:grid-cols-[1.15fr_1fr]">
            <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-10 -z-10 rounded-[48px] bg-surface" />
            <CaptureMock />
            <div className="grid gap-4 md:pt-10">
              <MatchMock />
            </div>
          </div>
        </section>

        {/* Promise strip */}
        <section aria-label="Alapelvek" className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Sparkles, "Magyarul ért", "„jövő kedden”, „holnapután”, „hatvan-hetven millió”"],
              [UserRoundCheck, "Te hagyod jóvá", "Az AI javasol, nem ír felül"],
              [MessageSquareQuote, "Forrással válaszol", "Minden állítás visszakereshető"],
              [Lock, "Zárt munkaterület", "Az adataidat csak a csapatod látja"],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Sparkles;
              return (
                <li key={title as string} className="flex items-start gap-3 bg-background p-5">
                  <I className="mt-0.5 size-5 shrink-0 text-accent" />
                  <span>
                    <span className="block text-sm font-medium text-ink">{title as string}</span>
                    <span className="block text-[13px] text-muted">{text as string}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Before / after */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Ismerős?</Eyebrow>
            <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">A nap végén jön a második műszak: a gépelés</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-border p-7">
              <p className="text-sm font-medium text-muted">Eddig</p>
              <ul className="mt-4 grid gap-3 text-[15px] text-text">
                {[
                  "Jegyzetek a telefonban, füzetben, Excelben",
                  "Este visszagépelni minden hívást",
                  "Fejben tartani, kit kell visszahívni",
                  "Portálos megkeresések elvesznek a levelek között",
                  "Végigböngészni a kínálatot minden új vevőnél",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-2.5 h-px w-3 shrink-0 bg-subtle" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl bg-primary p-7 text-white">
              <p className="text-sm font-medium text-white/60">Flavióval</p>
              <ul className="mt-4 grid gap-3 text-[15px]">
                {[
                  "Egy hely minden ügyfélnek, ingatlannak, hívásnak",
                  "Fél perc diktálás a hívás után, az AI kitölti",
                  "Reggel kész lista a mai teendőkről",
                  "A megkeresések maguktól bekerülnek",
                  "Az illő ingatlanok indoklással, azonnal",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="mt-1.5 grid size-4 shrink-0 place-items-center rounded-full bg-white/15 text-[10px]">
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="funkciok" className="scroll-mt-24 bg-surface py-24 sm:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <Eyebrow>Funkciók</Eyebrow>
                <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">Minden, ami a következő üzlethez kell</h2>
              </div>
              <p className="max-w-sm text-muted">Ingatlanosok napjára szabva, nem általános értékesítési rendszerből átfaragva.</p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f, i) => (
                <article key={f.title} className="flex flex-col rounded-3xl border border-border bg-background p-7">
                  <div className="flex items-center justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                      <f.icon className="size-5" />
                    </span>
                    <span className="text-sm text-subtle tabular-nums">/ {String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-8 text-[20px] leading-snug">{f.title}</h3>
                  <p className="mt-3 text-[15px] text-muted">{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Assistant showcase */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 sm:px-6 sm:py-32 md:grid-cols-2">
          <div>
            <Eyebrow>AI-asszisztens</Eyebrow>
            <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">Kérdezz úgy, mint egy kollégától</h2>
            <p className="mt-5 max-w-md text-muted">
              Nem kell szűrőket kattintgatni. Kérdezz rá ügyfélre, ingatlanra, levélre vagy teendőre – a válasz a saját
              adataidból jön, és minden állítás mellett ott a forrás egy kattintásra.
            </p>
            <ul className="mt-8 grid gap-2 text-[15px]">
              {["„Mely feladataim jártak le?”", "„Mit tudunk Kovács Annáról?”", "„Mely aktív ingatlanok illenek a vevőimhez?”"].map((q) => (
                <li key={q} className="w-fit rounded-full border border-border px-4 py-2 text-text">
                  {q}
                </li>
              ))}
            </ul>
          </div>
          <AssistantMock />
        </section>

        {/* How it works */}
        <section id="hogyan" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="mx-auto max-w-2xl text-center">
            <Eyebrow>Hogyan működik</Eyebrow>
            <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">Öt perc múlva már dolgozik helyetted</h2>
          </div>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-3xl border border-border p-7">
                <span className="text-sm text-subtle tabular-nums">/ {String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-6 text-[22px]">{s.title}</h3>
                <p className="mt-2 text-[15px] text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <CtaButtons />
          </div>
        </section>

        {/* Security */}
        <section id="biztonsag" className="scroll-mt-24 bg-surface py-24 sm:py-32">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 md:grid-cols-[1fr_1.2fr]">
            <div>
              <Eyebrow>Biztonság</Eyebrow>
              <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">Az ügyfeleid a tieid maradnak</h2>
              <p className="mt-5 max-w-md text-muted">
                Ingatlanosként bizalmas adatokkal dolgozol. Ezért a biztonság nem utólagos beállítás, hanem az alapoktól
                így épült.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {[
                [Lock, "Zárt munkaterület", "Minden adatsor munkaterülethez kötött, az adatbázis szintjén kikényszerítve."],
                [ShieldCheck, "Titkosított postafiók-kapcsolat", "Alapból csak olvasási jogot kérünk; küldési jogot csak külön engedéllyel. A hozzáférési kulcsot titkosítva tároljuk."],
                [UserRoundCheck, "Ember a döntésben", "Az AI javaslatai csak a jóváhagyásod után kerülnek be."],
                [Sparkles, "Szűkszavú napló", "Az AI-használatról csak technikai adatot naplózunk (mikor, mennyit), a tartalmat nem."],
              ].map(([Icon, title, text]) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={title as string} className="rounded-3xl border border-border bg-background p-6">
                    <I className="size-5 text-accent" />
                    <h3 className="mt-5 text-[17px]">{title as string}</h3>
                    <p className="mt-2 text-sm text-muted">{text as string}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Roadmap */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <Eyebrow>Hamarosan</Eyebrow>
              <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">A cél: nulla kézi bevitel</h2>
            </div>
            <p className="max-w-sm text-muted">Ezeken dolgozunk most. Ha most kezded, elsőként kapod meg őket.</p>
          </div>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {roadmap.map((r) => (
              <li key={r.title} className="rounded-3xl border border-dashed border-border-strong p-7">
                <div className="flex items-center justify-between">
                  <r.icon className="size-5 text-muted" />
                  <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">Hamarosan</span>
                </div>
                <h3 className="mt-6 text-[19px]">{r.title}</h3>
                <p className="mt-2 text-[15px] text-muted">{r.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* FAQ */}
        <section id="gyik" className="scroll-mt-24 mx-auto max-w-3xl px-4 pb-24 sm:px-6 sm:pb-32">
          <div className="text-center">
            <Eyebrow>GYIK</Eyebrow>
            <h2 className="mt-5 text-[32px] leading-tight sm:text-[48px]">Gyakori kérdések</h2>
          </div>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {faqs.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium text-ink [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-[15px] text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-6 sm:px-6">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[40px] bg-primary px-6 py-20 text-center sm:py-28">
            <div aria-hidden className="absolute -top-32 left-1/2 size-[520px] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl" />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium tracking-wide text-white/60 uppercase">
                <span aria-hidden>›</span> Kezdd el ma
              </span>
              {/* "!" beats the unlayered global heading colour. */}
              <h2 className="mx-auto mt-6 max-w-3xl text-[36px] leading-[1.05] text-white! sm:text-[60px]">
                A következő hívásod után már nem kell gépelned
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-white/70">
                Regisztrálj egy perc alatt, rögzítsd az első hívást, és nézd meg, mit csinál belőle az AI.
              </p>
              <div className="mt-9">
                <CtaButtons dark />
              </div>
              <p className="mt-4 text-[13px] text-white/50">Ingyenes regisztráció · Bankkártya nélkül</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 text-sm text-muted sm:flex-row sm:px-6">
        <Logo href="/" />
        <nav className="flex gap-5">
          <a href="#funkciok" className="hover:text-ink">Funkciók</a>
          <a href="#gyik" className="hover:text-ink">GYIK</a>
          <Link href="/login" className="hover:text-ink">Belépés</Link>
          <Link href="/adatvedelem" className="hover:text-ink">Adatvédelem</Link>
        </nav>
        <p>© Flavio</p>
      </footer>
    </div>
  );
}
