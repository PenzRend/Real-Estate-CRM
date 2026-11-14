import { describe, expect, it } from "vitest";
import { change, periodOf, summaryLine } from "@/lib/summary/period";

describe("summary periods", () => {
  it("covers a day, a Monday-to-Sunday week and a calendar month", () => {
    expect(periodOf("day", "2026-11-14")).toMatchObject({ from: "2026-11-14", to: "2026-11-15", previousFrom: "2026-11-13", nextTo: "2026-11-16", label: "Ma" });
    expect(periodOf("day", "2026-11-14", -1).label).toBe("Tegnap");
    expect(periodOf("week", "2026-11-14")).toMatchObject({ from: "2026-11-09", to: "2026-11-16", previousFrom: "2026-11-02", label: "Ez a hét" });
    expect(periodOf("week", "2026-11-16", -1)).toMatchObject({ from: "2026-11-09", to: "2026-11-16", label: "Múlt hét" });
    expect(periodOf("week", "2026-11-14", -2).label).toBe("október 26. – november 1.");
    expect(periodOf("month", "2026-11-14")).toMatchObject({ from: "2026-11-01", to: "2026-12-01", previousFrom: "2026-10-01", nextTo: "2027-01-01", label: "Ez a hónap (november)" });
    expect(periodOf("month", "2027-01-01", -1)).toMatchObject({ from: "2026-12-01", to: "2027-01-01", label: "2026. december" });
  });

  it("says only what happened", () => {
    const n = { newClients: 2, conversations: 0, viewings: 3, newListings: 0, offers: 0, dealsWon: 1, commission: 1_500_000, tasksDone: 0 };
    expect(summaryLine(n)).toBe("2 új ügyfél · 3 megtekintés · 1 lezárt ügylet (1,5 M Ft)");
    expect(summaryLine({ ...n, newClients: 0, viewings: 0, dealsWon: 0, commission: 0 })).toBe("Ebben az időszakban még nincs rögzített munka.");
    expect(change(5, 3)).toBe("↑ 2");
    expect(change(1, 3)).toBe("↓ 2");
    expect(change(2, 2)).toBe("");
  });
});
