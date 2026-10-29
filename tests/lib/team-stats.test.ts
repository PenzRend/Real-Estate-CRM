import { describe, expect, it } from "vitest";
import { monthBounds, officeMonth, progressPercent } from "@/lib/team/stats";

describe("officeMonth", () => {
  const facts = {
    members: [
      { userId: "a", name: "Anna" },
      { userId: "b", name: "Béla" },
    ],
    leads: ["a", "a", "b", null],
    viewings: ["b", "b", "b"],
    listings: ["a", null],
    wonDeals: [
      { agentId: "b", commission: 2_000_000 },
      { agentId: "a", commission: null },
    ],
    openDeals: [{ agentId: "a", commission: 1_500_000 }],
    targets: [{ userId: "b", commission: 3_000_000, deals: 2, listings: null, viewings: 10 }],
  };

  it("counts each agent's month and orders by commission", () => {
    const { agents } = officeMonth(facts);
    expect(agents.map((a) => a.userId)).toEqual(["b", "a"]);
    expect(agents[0]).toMatchObject({ leads: 1, viewings: 3, dealsWon: 1, commission: 2_000_000, target: { deals: 2 } });
    expect(agents[1]).toMatchObject({ leads: 2, listings: 1, dealsWon: 1, commission: 0, pipeline: 1_500_000, target: null });
  });

  it("totals include what isn't tied to a member, and sum only the set targets", () => {
    const { total } = officeMonth(facts);
    expect(total).toMatchObject({ leads: 4, listings: 2, dealsWon: 2, commission: 2_000_000, pipeline: 1_500_000 });
    expect(total.target).toEqual({ commission: 3_000_000, deals: 2, listings: null, viewings: 10 });
  });
});

describe("progressPercent", () => {
  it("is null without a target and can exceed 100", () => {
    expect(progressPercent(5, null)).toBeNull();
    expect(progressPercent(5, 0)).toBeNull();
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(6, 4)).toBe(150);
  });
});

describe("monthBounds", () => {
  it("wraps at the year's ends", () => {
    expect(monthBounds("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01", next: "2027-01", previous: "2026-11" });
    expect(monthBounds("2026-01")).toMatchObject({ previous: "2025-12", next: "2026-02" });
  });
});
