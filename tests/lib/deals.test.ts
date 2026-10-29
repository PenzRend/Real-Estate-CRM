import { describe, expect, it } from "vitest";
import { commission, commissionMonth, milestoneTasks, nextDeadline, nextStage, previousStage, propertyStatusFor } from "@/lib/deals/logic";

const noDates = { deposit_due: null, deposit_paid_on: null, contract_on: null, financing_deadline: null, handover_on: null, commission_paid_on: null };

describe("deals", () => {
  it("walks the stages in order", () => {
    expect(nextStage("offer")).toBe("deposit");
    expect(nextStage("handover")).toBe("closed");
    expect(nextStage("closed")).toBeNull();
    expect(previousStage("offer")).toBeNull();
    expect(previousStage("contract")).toBe("deposit");
  });

  it("counts the commission: a fixed amount wins, else the percentage of the agreed price", () => {
    expect(commission({ agreed_price: 80_000_000, commission_percent: 3, commission_amount: null })).toBe(2_400_000);
    expect(commission({ agreed_price: 80_000_000, commission_percent: 3, commission_amount: 1_500_000 })).toBe(1_500_000);
    expect(commission({ agreed_price: null, commission_percent: 3, commission_amount: null })).toBeNull();
  });

  it("turns set dates into tasks, and drops the ones already done", () => {
    const tasks = milestoneTasks({ ...noDates, deposit_due: "2026-11-05", contract_on: "2026-11-20", handover_on: "2027-01-15" }, { property: "Napfényes lakás" });
    expect(tasks.filter((t) => t.date).map((t) => [t.milestone, t.date])).toEqual([
      ["deposit", "2026-11-05"],
      ["contract", "2026-11-20"],
      ["handover", "2027-01-15"],
      ["commission", "2027-01-15"],
    ]);
    expect(tasks[0].title).toBe("Foglaló beérkezése – Napfényes lakás");
    const paid = milestoneTasks({ ...noDates, deposit_due: "2026-11-05", deposit_paid_on: "2026-11-04", handover_on: "2027-01-15", commission_paid_on: "2027-01-20" }, { property: "X" });
    expect(paid.find((t) => t.milestone === "deposit")?.date).toBeNull();
    expect(paid.find((t) => t.milestone === "commission")?.date).toBeNull();
  });

  it("keeps the listing's status in step with the deal", () => {
    expect(propertyStatusFor("offer", "open", "sale")).toBe("under_negotiation");
    expect(propertyStatusFor("contract", "open", "sale")).toBe("reserved");
    expect(propertyStatusFor("closed", "won", "sale")).toBe("sold");
    expect(propertyStatusFor("closed", "won", "rent")).toBe("rented");
    expect(propertyStatusFor("deposit", "lost", "sale")).toBe("active");
  });

  it("finds the next date and the commission's month", () => {
    expect(nextDeadline({ ...noDates, contract_on: "2026-11-20", deposit_due: "2026-11-05", deposit_paid_on: "2026-11-04" })).toEqual({ label: "Adásvételi", date: "2026-11-20" });
    expect(nextDeadline(noDates)).toBeNull();
    expect(commissionMonth({ ...noDates, contract_on: "2026-11-20", handover_on: "2027-01-15" })).toBe("2027-01");
    expect(commissionMonth({ ...noDates, handover_on: "2027-01-15", commission_paid_on: "2027-02-02" })).toBe("2027-02");
  });
});
