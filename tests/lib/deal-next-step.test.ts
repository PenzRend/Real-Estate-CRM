import { describe, expect, it } from "vitest";
import { nextStep, type NextStepInput } from "@/lib/deals/next-step";

const base: NextStepInput = {
  stage: "offer",
  status: "open",
  rent: false,
  deposit_amount: null,
  agreed_price: null,
  offers: [],
  contracts: [],
  unidentified: [],
  deposit_due: null,
  deposit_paid_on: null,
  contract_on: null,
  financing_deadline: null,
  handover_on: null,
  commission_paid_on: null,
};
const today = "2026-11-08";
const kinds = (s: ReturnType<typeof nextStep>) => s?.actions.map((a) => a.kind + ("stage" in a ? `:${a.stage}` : "contract" in a ? `:${a.contract}` : "field" in a ? `:${a.field}` : ""));

describe("nextStep", () => {
  it("walks an offer to the deposit", () => {
    expect(kinds(nextStep(base, today))).toEqual(["offers"]);
    expect(nextStep({ ...base, offers: [{ status: "open" }] }, today)?.title).toMatch(/Nyitott ajánlat/);
    expect(kinds(nextStep({ ...base, offers: [{ status: "accepted" }] }, today))).toEqual(["contract:foglalasi", "move:deposit"]);
    expect(kinds(nextStep({ ...base, agreed_price: 80e6, rent: true, contracts: ["berleti"] }, today))).toEqual(["move:deposit"]);
  });

  it("asks for the deposit, its paper and its arrival in turn", () => {
    const d = { ...base, stage: "deposit" as const };
    expect(kinds(nextStep(d, today))).toEqual(["fill:deposit_amount"]);
    expect(kinds(nextStep({ ...d, deposit_amount: 2e6 }, today))).toEqual(["contract:foglalasi"]);
    expect(kinds(nextStep({ ...d, deposit_amount: 2e6, contracts: ["foglalasi"] }, today))).toEqual(["today:deposit_paid_on", "fill:deposit_due"]);
    expect(kinds(nextStep({ ...d, deposit_amount: 2e6, contracts: ["foglalasi"], deposit_paid_on: today }, today))).toEqual(["move:contract"]);
  });

  it("puts the identification first at the contract, then waits for the signing day", () => {
    const d = { ...base, stage: "contract" as const };
    expect(kinds(nextStep({ ...d, unidentified: [{ name: "Kiss Anna", href: "/clients/x/azonositas" }] }, today))).toEqual(["link"]);
    expect(kinds(nextStep(d, today))).toEqual(["contract:adasveteli"]);
    const waiting = nextStep({ ...d, contracts: ["adasveteli"], contract_on: "2026-11-20" }, today);
    expect(waiting?.waiting).toBe(true);
    expect(kinds(nextStep({ ...d, contracts: ["adasveteli"], contract_on: today }, today))).toEqual(["move:financing", "move:handover"]);
  });

  it("ends at the handover, and shows nothing for closed deals", () => {
    const d = { ...base, stage: "handover" as const, handover_on: "2026-11-01" };
    expect(kinds(nextStep(d, today))).toEqual(["contract:atadas"]);
    expect(kinds(nextStep({ ...d, contracts: ["atadas"] }, today))).toEqual(["move:closed"]);
    expect(nextStep({ ...base, status: "won" }, today)).toBeNull();
  });
});
