import { describe, expect, it } from "vitest";
import { lastWeek, trend, weekLine } from "@/lib/team/week-text";

describe("lastWeek", () => {
  it("is the Monday-to-Monday before the current week", () => {
    expect(lastWeek("2026-11-09")).toEqual({ from: "2026-11-02", to: "2026-11-09", previousFrom: "2026-10-26" }); // a Monday
    expect(lastWeek("2026-11-08")).toEqual({ from: "2026-10-26", to: "2026-11-02", previousFrom: "2026-10-19" }); // a Sunday
  });
});

describe("weekLine and trend", () => {
  it("says the week in one line", () => {
    expect(weekLine({ leads: 4, viewings: 6, listings: 2, dealsWon: 1, commission: 1_500_000 })).toBe("4 új ügyfél · 6 megtekintés · 2 új megbízás · 1 lezárt ügylet (1,5 M Ft)");
    expect(weekLine({ leads: 0, viewings: 0, listings: 0, dealsWon: 0, commission: 0 })).toBe("0 új ügyfél · 0 megtekintés · 0 új megbízás · 0 lezárt ügylet");
    expect(trend(5, 3)).toBe("↑ 2");
    expect(trend(1, 3)).toBe("↓ 2");
    expect(trend(2, 2)).toBe("");
  });
});
