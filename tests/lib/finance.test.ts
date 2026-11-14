import { describe, expect, it } from "vitest";
import { bucketsOf, byMonth, categoriesThisYear, expenseIn, expenseOn, lastMonths, monthlyRecurring, percentChange, rangeOf, runningMonthly, seriesOf, type Expense } from "@/lib/finance";

const e = (over: Partial<Expense>): Expense => ({ id: "x", spentOn: "2026-09-10", category: "hosting", description: "Vercel", amount: 8000, monthly: false, endsOn: null, ...over });

describe("lastMonths", () => {
  it("counts back across a year", () => {
    expect(lastMonths("2026-02-14", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("expenseIn", () => {
  it("counts a one-off cost only in its month", () => {
    expect(expenseIn(e({}), "2026-09")).toBe(8000);
    expect(expenseIn(e({}), "2026-10")).toBe(0);
  });
  it("counts a monthly cost from its start until it ends", () => {
    const m = e({ monthly: true, endsOn: "2026-11-05" });
    expect(expenseIn(m, "2026-08")).toBe(0);
    expect(expenseIn(m, "2026-09")).toBe(8000);
    expect(expenseIn(m, "2026-11")).toBe(8000);
    expect(expenseIn(m, "2026-12")).toBe(0);
  });
});

describe("byMonth", () => {
  it("puts income and expenses side by side", () => {
    const rows = byMonth(["2026-10", "2026-11"], [{ amount: 9900, paidAt: "2026-11-02T10:00:00Z" }, { amount: 9900, paidAt: "2026-11-20T10:00:00Z" }], [e({ monthly: true })]);
    expect(rows).toEqual([
      { month: "2026-10", income: 0, expenses: 8000, result: -8000, payments: 0 },
      { month: "2026-11", income: 19800, expenses: 8000, result: 11800, payments: 2 },
    ]);
  });
});

describe("categoriesThisYear and runningMonthly", () => {
  it("adds up this year by category, and what still runs monthly", () => {
    const list = [e({ monthly: true }), e({ id: "y", category: "domain", amount: 5000, spentOn: "2026-03-01" }), e({ id: "z", category: "ai", amount: 20000, spentOn: "2025-12-01" })];
    expect(categoriesThisYear(list, "2026-11-14")).toEqual([
      { category: "hosting", amount: 24000 },
      { category: "domain", amount: 5000 },
    ]);
    expect(runningMonthly(list, "2026-11-14")).toBe(8000);
  });
});

describe("monthlyRecurring", () => {
  it("counts paying seats, a yearly plan as a twelfth, and leaves out ones ending", () => {
    const price = { month: 9900, year: 99000 };
    expect(
      monthlyRecurring(
        [
          { status: "active", seats: 2, interval: "month", cancelAtPeriodEnd: false },
          { status: "active", seats: 1, interval: "year", cancelAtPeriodEnd: false },
          { status: "active", seats: 3, interval: "month", cancelAtPeriodEnd: true },
          { status: "trialing", seats: null, interval: null, cancelAtPeriodEnd: false },
        ],
        price,
      ),
    ).toBe(2 * 9900 + 8250);
  });
});


describe("rangeOf", () => {
  it("takes the last 30 days and the 30 before", () => {
    expect(rangeOf("30", "2026-11-15")).toMatchObject({ from: "2026-10-17", to: "2026-11-16", prevFrom: "2026-09-17", prevTo: "2026-10-17", bucket: "day" });
  });
  it("compares this year with last year up to the same day", () => {
    expect(rangeOf("ev", "2026-11-15")).toMatchObject({ from: "2026-01-01", to: "2026-11-16", prevFrom: "2025-01-01", prevTo: "2025-11-16", bucket: "month" });
  });
  it("takes 12 whole months for the 12-month view", () => {
    expect(rangeOf("12h", "2026-11-15")).toMatchObject({ from: "2025-12-01", prevFrom: "2024-12-01", prevTo: "2025-12-01" });
  });
  it("falls back to 30 days for an unknown key", () => {
    expect(rangeOf("x", "2026-11-15").key).toBe("30");
  });
});

describe("expenseOn and seriesOf", () => {
  const monthly = e({ monthly: true, amount: 3000, spentOn: "2026-11-01" });
  it("spreads a monthly cost over its month's days", () => {
    expect(expenseOn(monthly, "2026-11-10")).toBe(100);
    expect(expenseOn(monthly, "2026-10-31")).toBe(0);
  });
  it("buckets by month, cut at the end of the range", () => {
    expect(bucketsOf("2026-10-01", "2026-11-16", "month")).toEqual([
      { start: "2026-10-01", end: "2026-11-01" },
      { start: "2026-11-01", end: "2026-11-16" },
    ]);
  });
  it("adds income, payments, expenses and new users per point", () => {
    const s = seriesOf("2026-11-01", "2026-11-03", "day", { income: [{ amount: 9900, day: "2026-11-02" }], expenses: [monthly], userDays: ["2026-11-01", "2026-11-01"] });
    expect(s).toEqual([
      { start: "2026-11-01", income: 0, expenses: 100, payments: 0, newUsers: 2 },
      { start: "2026-11-02", income: 9900, expenses: 100, payments: 1, newUsers: 0 },
    ]);
  });
});

describe("percentChange", () => {
  it("says how much it moved, and nothing when there was nothing before", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(0, 0)).toBe(0);
  });
});
