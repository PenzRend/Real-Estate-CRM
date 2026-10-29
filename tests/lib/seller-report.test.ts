import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { reportPeriod } from "@/lib/reports/data";
import { sellerReport, type SellerFacts } from "@/lib/reports/seller";

const base: SellerFacts = {
  ownerName: "Kovács János",
  propertyTitle: "Napfényes 2 hálós lakás",
  periodStart: "2026-10-19",
  periodEnd: "2026-10-25",
  askingPrice: 77_000_000,
  currency: "HUF",
  daysOnMarket: 23,
  viewings: [],
  noShows: 0,
  upcomingViewings: [],
  inquiries: 0,
  offers: [],
  shareViews: null,
  agentName: "Orosz Géza",
};

describe("weekly seller report", () => {
  it("tells the owner about viewings without naming buyers, offers and interest", () => {
    const { subject, body } = sellerReport(
      {
        ...base,
        viewings: [
          { date: "2026-10-21", interest: "high", feedback: "Tetszett az erkély,\nde a konyhát felújítaná." },
          { date: "2026-10-24", interest: null, feedback: null },
        ],
        noShows: 1,
        upcomingViewings: [{ date: "2026-10-28" }],
        inquiries: 3,
        offers: [{ amount: 74_000_000, status: "countered", madeBy: "buyer" }],
        shareViews: 45,
      },
      "Javaslom, hogy a hétvégén tartsunk nyílt napot.",
    );
    expect(subject).toBe("Heti összefoglaló: Napfényes 2 hálós lakás");
    expect(body).toContain("Kedves Kovács János!");
    expect(body).toContain("Megtekintések: 2 (és 1 elmaradt)");
    expect(body).toContain("egy érdeklődő nagyon érdeklődik – „Tetszett az erkély, de a konyhát felújítaná.”");
    expect(body).toContain("visszajelzés még nincs");
    expect(body).toContain("1 megtekintés van egyeztetve");
    expect(body).toMatch(/74\s000\s000\sFt \(vevői ajánlat, ellenajánlatot kapott\)/);
    expect(body).toContain("3 új megkeresés érkezett a hirdetésre, a hirdetés oldalát eddig 45 alkalommal nyitották meg.");
    expect(body).toContain("Javaslom, hogy a hétvégén tartsunk nyílt napot.");
    expect(body.trim().endsWith("Orosz Géza")).toBe(true);
  });

  it("says so plainly when the week was quiet", () => {
    const { body } = sellerReport(base);
    expect(body).toContain("Ezen a héten nem volt megtekintés.");
    expect(body).not.toContain("Ajánlatok");
    expect(body).toMatch(/A hirdetés 23 napja aktív, az irányár 77\s000\s000\sFt\./);
  });

  it("covers the seven days before the report, in Budapest time", () => {
    const p = reportPeriod(new Date("2026-10-26T06:00:00Z")); // Monday 7:00 in Budapest
    expect(p.start).toBe("2026-10-19");
    expect(p.end).toBe("2026-10-25");
    expect(p.from).toBe("2026-10-18T22:00:00.000Z");
    expect(p.to).toBe("2026-10-25T23:00:00.000Z");
  });
});
