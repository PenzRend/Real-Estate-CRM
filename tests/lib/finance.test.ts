import { describe, expect, it } from "vitest";
import { byMonth, categoriesThisYear, expenseIn, lastMonths, monthlyRecurring, runningMonthly, type Expense } from "@/lib/finance";

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
