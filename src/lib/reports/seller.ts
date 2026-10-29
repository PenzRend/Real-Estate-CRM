// The weekly report to a listing's owner, as text: what happened with their
// property this week. Buyers stay anonymous. Pure, so it is tested.

import { formatPrice } from "@/lib/i18n/format";

export type SellerFacts = {
  ownerName: string;
  propertyTitle: string;
  /** Local dates, "2026-10-22". */
  periodStart: string;
  periodEnd: string;
  askingPrice: number | null;
  currency: "HUF" | "EUR";
  daysOnMarket: number | null;
  viewings: { date: string; interest: "high" | "medium" | "low" | "none" | null; feedback: string | null }[];
  noShows: number;
  upcomingViewings: { date: string }[];
  inquiries: number;
  offers: { amount: number; status: "open" | "accepted" | "rejected" | "countered"; madeBy: "buyer" | "seller" }[];
  shareViews: number | null;
  agentName: string;
};

const interestText = { high: "nagyon érdeklődik", medium: "érdeklődik", low: "kevésbé érdeklődik", none: "nem érdekli" } as const;
const offerText = { open: "válaszra vár", accepted: "elfogadva", rejected: "elutasítva", countered: "ellenajánlatot kapott" } as const;

const shortDate = (d: string) => new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T00:00:00Z`));

export function sellerReport(f: SellerFacts, note?: string | null): { subject: string; body: string } {
  const lines: string[] = [`Kedves ${f.ownerName}!`, "", `Összefoglalom, mi történt a(z) „${f.propertyTitle}” hirdetéssel az elmúlt héten (${shortDate(f.periodStart)} – ${shortDate(f.periodEnd)}).`, ""];

  if (f.viewings.length) {
    lines.push(`Megtekintések: ${f.viewings.length}${f.noShows ? ` (és ${f.noShows} elmaradt)` : ""}`);
    for (const v of f.viewings) {
      const what = v.interest ? interestText[v.interest] : "visszajelzés még nincs";
      lines.push(`– ${shortDate(v.date)}: egy érdeklődő ${what}${v.feedback ? ` – „${v.feedback.replace(/\s+/g, " ").trim().slice(0, 300)}”` : ""}.`);
    }
  } else {
    lines.push(`Ezen a héten nem volt megtekintés${f.noShows ? ` (${f.noShows} egyeztetett időpont elmaradt)` : ""}.`);
  }
  if (f.upcomingViewings.length) {
    lines.push(`A következő napokban ${f.upcomingViewings.length} megtekintés van egyeztetve (${f.upcomingViewings.map((v) => shortDate(v.date)).join(", ")}).`);
  }
  lines.push("");

  if (f.offers.length) {
    lines.push("Ajánlatok:");
    for (const o of f.offers) lines.push(`– ${formatPrice(o.amount, f.currency)} (${o.madeBy === "buyer" ? "vevői ajánlat" : "az Ön ellenajánlata"}, ${offerText[o.status]})`);
    lines.push("");
  }

  const interest: string[] = [];
  if (f.inquiries) interest.push(`${f.inquiries} új megkeresés érkezett a hirdetésre`);
  if (f.shareViews) interest.push(`a hirdetés oldalát eddig ${f.shareViews} alkalommal nyitották meg`);
  if (interest.length) lines.push(`${interest.join(", ").replace(/^./, (c) => c.toUpperCase())}.`);
  if (f.daysOnMarket != null) lines.push(`A hirdetés ${f.daysOnMarket} napja aktív${f.askingPrice != null ? `, az irányár ${formatPrice(f.askingPrice, f.currency)}` : ""}.`);

  if (note?.trim()) lines.push("", note.trim());
  lines.push("", "Ha kérdése van, keressen bizalommal.", "", "Üdvözlettel:", f.agentName);

  return { subject: `Heti összefoglaló: ${f.propertyTitle}`.slice(0, 300), body: lines.join("\n").replace(/\n{3,}/g, "\n\n") };
}
