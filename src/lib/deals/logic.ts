// Deals: the stages of a Hungarian property sale and the sums and dates that
// go with them. Pure, safe for client components.

export const DEAL_STAGES = ["offer", "deposit", "contract", "financing", "handover", "closed"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export type DealStatus = "open" | "won" | "lost";

export const stageLabels: Record<DealStage, string> = {
  offer: "Ajánlat",
  deposit: "Foglaló",
  contract: "Adásvételi",
  financing: "Finanszírozás",
  handover: "Birtokbaadás",
  closed: "Jutalék",
};

/** One line per stage: what happens there. */
export const stageHints: Record<DealStage, string> = {
  offer: "Ajánlat és alku a vevő és az eladó között.",
  deposit: "Megállapodtak: foglaló vagy előleg, foglalási megállapodás.",
  contract: "Adásvételi szerződés az ügyvédnél.",
  financing: "Hitelbírálat, banki értékbecslés, vételár-részletek.",
  handover: "Birtokbaadás, közművek átírása.",
  closed: "A jutalék kifizetése, és kész.",
};

export const partyRoleLabels = {
  lawyer: "Ügyvéd",
  bank: "Bank",
  mortgage_advisor: "Hiteltanácsadó",
  notary: "Közjegyző",
  valuer: "Értékbecslő",
  other: "Egyéb",
} as const;
export type PartyRole = keyof typeof partyRoleLabels;

export const nextStage = (stage: DealStage): DealStage | null => DEAL_STAGES[DEAL_STAGES.indexOf(stage) + 1] ?? null;
export const previousStage = (stage: DealStage): DealStage | null => DEAL_STAGES[DEAL_STAGES.indexOf(stage) - 1] ?? null;

/** The commission: the fixed amount if set, else the percentage of the agreed price; null when neither is known. */
export function commission(d: { agreed_price: number | null; commission_percent: number | null; commission_amount: number | null }): number | null {
  if (d.commission_amount != null) return Number(d.commission_amount);
  if (d.agreed_price != null && d.commission_percent != null) return Math.round((Number(d.agreed_price) * Number(d.commission_percent)) / 100);
  return null;
}

export type Milestone = "deposit" | "contract" | "financing" | "handover" | "commission";

export type MilestoneDates = {
  deposit_due: string | null;
  deposit_paid_on: string | null;
  contract_on: string | null;
  financing_deadline: string | null;
  handover_on: string | null;
  commission_paid_on: string | null;
};

/**
 * The tasks a deal's dates stand for: each date that is set (and not already
 * done) is a task due that day at 9:00; a cleared date drops its task. The
 * commission task follows the handover until the commission is paid.
 */
export function milestoneTasks(d: MilestoneDates, names: { property: string }): { milestone: Milestone; title: string; date: string | null }[] {
  return [
    { milestone: "deposit", title: `Foglaló beérkezése – ${names.property}`, date: d.deposit_paid_on ? null : d.deposit_due },
    { milestone: "contract", title: `Adásvételi szerződés aláírása – ${names.property}`, date: d.contract_on },
    { milestone: "financing", title: `Hitelbírálat / finanszírozás határideje – ${names.property}`, date: d.financing_deadline },
    { milestone: "handover", title: `Birtokbaadás – ${names.property}`, date: d.handover_on },
    { milestone: "commission", title: `Jutalék számlázása – ${names.property}`, date: d.commission_paid_on ? null : d.handover_on },
  ];
}

/** What the listing's status becomes when a deal reaches a stage (or ends); null leaves it alone. */
export function propertyStatusFor(stage: DealStage, status: DealStatus, listing: "sale" | "rent"): string | null {
  if (status === "lost") return "active";
  if (status === "won") return listing === "rent" ? "rented" : "sold";
  if (stage === "offer") return "under_negotiation";
  return "reserved";
}

/** The next date that still matters for an open deal: the soonest open milestone. */
export function nextDeadline(d: MilestoneDates): { label: string; date: string } | null {
  const candidates: { label: string; date: string | null }[] = [
    { label: "Foglaló", date: d.deposit_paid_on ? null : d.deposit_due },
    { label: "Adásvételi", date: d.contract_on },
    { label: "Finanszírozás", date: d.financing_deadline },
    { label: "Birtokbaadás", date: d.handover_on },
  ];
  const dated = candidates.filter((c): c is { label: string; date: string } => Boolean(c.date)).sort((a, b) => a.date.localeCompare(b.date));
  return dated[0] ?? null;
}

/** The month a deal's commission is expected in ("2026-11"): when it was paid, else the handover, else the contract. */
export function commissionMonth(d: MilestoneDates & { closed_at?: string | null }): string | null {
  const date = d.commission_paid_on ?? d.handover_on ?? d.contract_on ?? d.closed_at ?? null;
  return date ? date.slice(0, 7) : null;
}
