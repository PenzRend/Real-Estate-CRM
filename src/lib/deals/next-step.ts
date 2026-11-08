import type { DealStage, MilestoneDates } from "./logic";
import { stageLabels } from "./logic";

// "Mi a következő lépés?" for a deal: from its stage and what is already
// filled in, one sentence and the one or two buttons that move it on. Pure,
// so it is tested; the deal page shows it at the top.

export type NextAction =
  | { kind: "today"; field: keyof MilestoneDates; label: string } // set a date to today
  | { kind: "fill"; field: string; label: string } // jump to the field to fill it
  | { kind: "move"; stage: DealStage; label: string }
  | { kind: "contract"; contract: "foglalasi" | "adasveteli" | "berleti" | "atadas"; label: string }
  | { kind: "offers"; label: string }
  | { kind: "link"; href: string; label: string };

export type NextStep = { title: string; detail?: string; actions: NextAction[]; waiting?: boolean };

export type NextStepInput = MilestoneDates & {
  stage: DealStage;
  status: "open" | "won" | "lost";
  rent: boolean;
  deposit_amount: number | null;
  agreed_price: number | null;
  offers: { status: "open" | "accepted" | "rejected" | "countered" }[];
  /** Kinds of contract drafts already made for the deal. */
  contracts: string[];
  /** Parties without an anti-money-laundering identification, with their page. */
  unidentified: { name: string; href: string }[];
};

const huDate = (d: string) => new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function nextStep(d: NextStepInput, today: string): NextStep | null {
  if (d.status !== "open") return null;
  const later = (date: string | null) => date != null && date > today;
  const reserve: "foglalasi" | "berleti" = d.rent ? "berleti" : "foglalasi";
  const ident = d.unidentified[0];

  switch (d.stage) {
    case "offer": {
      if (d.offers.some((o) => o.status === "accepted") || d.agreed_price != null) {
        return {
          title: "Megvan az ár – jöhet a foglaló.",
          detail: d.rent ? "Készíts bérleti szerződést, és lépj tovább." : "Készíts foglalási megállapodást, és lépj tovább a foglaló szakaszba.",
          actions: [
            ...(d.contracts.includes(reserve) ? [] : [{ kind: "contract" as const, contract: reserve, label: d.rent ? "Bérleti szerződés" : "Foglalási megállapodás" }]),
            { kind: "move", stage: "deposit", label: `Tovább: ${stageLabels.deposit}` },
          ],
        };
      }
      if (d.offers.some((o) => o.status === "open")) return { title: "Nyitott ajánlat vár válaszra.", detail: "Fogadd el, utasítsd el, vagy rögzítsd az ellenajánlatot.", actions: [{ kind: "offers", label: "Ajánlatok" }] };
      return { title: "Rögzítsd a vevő ajánlatát.", detail: "Az elfogadott ajánlat összege lesz a vételár.", actions: [{ kind: "offers", label: "Ajánlat rögzítése" }] };
    }
    case "deposit": {
      if (d.deposit_amount == null) return { title: "Mennyi a foglaló?", actions: [{ kind: "fill", field: "deposit_amount", label: "Összeg megadása" }] };
      if (!d.contracts.includes(reserve)) return { title: d.rent ? "Készítsd el a bérleti szerződést." : "Készítsd el a foglalási megállapodást.", actions: [{ kind: "contract", contract: reserve, label: d.rent ? "Bérleti szerződés" : "Foglalási megállapodás" }] };
      if (!d.deposit_paid_on) {
        return {
          title: "Megérkezett a foglaló?",
          detail: d.deposit_due ? `Határidő: ${huDate(d.deposit_due)}.` : "Ha még nem, add meg a határidejét – emlékeztetni foglak.",
          actions: [{ kind: "today", field: "deposit_paid_on", label: "Igen, ma megérkezett" }, ...(d.deposit_due ? [] : [{ kind: "fill" as const, field: "deposit_due", label: "Határidő" }])],
        };
      }
      return { title: "A foglaló rendben.", detail: "Jöhet az adásvételi szerződés.", actions: [{ kind: "move", stage: "contract", label: `Tovább: ${stageLabels.contract}` }] };
    }
    case "contract": {
      if (ident) return { title: `Hiányzik ${ident.name} azonosítása.`, detail: "Az adásvétel előtt kötelező (Pmt.).", actions: [{ kind: "link", href: ident.href, label: "Azonosítás" }] };
      if (!d.rent && !d.contracts.includes("adasveteli")) return { title: "Küldd át az ügyvédnek az adatokat.", detail: "Flavio összeállítja az adásvételi tervezetet a felek és az ingatlan adataiból.", actions: [{ kind: "contract", contract: "adasveteli", label: "Adásvételi tervezet" }] };
      if (!d.contract_on) return { title: "Mikor írják alá az adásvételit?", actions: [{ kind: "fill", field: "contract_on", label: "Időpont megadása" }] };
      if (later(d.contract_on)) return { title: `Aláírás: ${huDate(d.contract_on)}.`, detail: "Addig nincs teendő – aznap reggel emlékeztetlek.", actions: [], waiting: true };
      return {
        title: "Aláírták az adásvételit?",
        detail: "Ha a vevő hitelből vásárol, jön a finanszírozás; ha nem, a birtokbaadás.",
        actions: [
          { kind: "move", stage: "financing", label: "Igen, hitel jön" },
          { kind: "move", stage: "handover", label: "Igen, nincs hitel" },
        ],
      };
    }
    case "financing": {
      if (!d.financing_deadline) return { title: "Meddig kell a hitelnek meglennie?", actions: [{ kind: "fill", field: "financing_deadline", label: "Határidő megadása" }] };
      return {
        title: later(d.financing_deadline) ? `Finanszírozás határideje: ${huDate(d.financing_deadline)}.` : "Lejárt a finanszírozás határideje.",
        detail: "Ha a bank folyósított, jöhet a birtokbaadás.",
        actions: [{ kind: "move", stage: "handover", label: "Folyósítva – tovább" }],
      };
    }
    case "handover": {
      if (!d.handover_on) return { title: "Mikor adják át az ingatlant?", actions: [{ kind: "fill", field: "handover_on", label: "Időpont megadása" }] };
      if (!d.contracts.includes("atadas")) return { title: "Készítsd elő az átadás-átvételi jegyzőkönyvet.", detail: `Átadás: ${huDate(d.handover_on)}. A mérőóra-állásokat a helyszínen írod be.`, actions: [{ kind: "contract", contract: "atadas", label: "Jegyzőkönyv" }] };
      if (later(d.handover_on)) return { title: `Átadás: ${huDate(d.handover_on)}.`, detail: "A jegyzőkönyv kész; aznap reggel emlékeztetlek.", actions: [], waiting: true };
      return {
        title: "Megtörtént az átadás?",
        detail: "Ha a jutalék is rendben, zárd le: az ügylet sikeres lesz, a jutalék a mai nappal kifizetettnek számít.",
        actions: [{ kind: "move", stage: "closed", label: "Igen – lezárás sikeresként" }],
      };
    }
    case "closed":
      // Reaching this stage closes the deal as won.
      return null;
  }
}
