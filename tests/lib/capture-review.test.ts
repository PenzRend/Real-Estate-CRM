import { describe, expect, it } from "vitest";
import type { CaptureExtraction } from "@/lib/ai/capture-schema";
import { locationKey, outcomeText, proposedFields, toUpdateValue } from "@/lib/capture/review";
import type { ClientSnapshot } from "@/lib/db/activity";

const extraction: CaptureExtraction = {
  interaction_type: "call",
  summary: "Péter 2 hálós lakást keres a XI. kerületben.",
  client: { full_name: "Péter", phone: "+36 30 123 4567", email: null, client_type: "buyer" },
  requirements: {
    budget_min: null,
    budget_max: 80_000_000,
    budget_is_approximate: true,
    locations: ["Budapest XI. kerület", "Budaörs"],
    property_types: ["apartment"],
    min_rooms: null,
    min_bedrooms: 2,
    min_area_sqm: null,
    max_area_sqm: null,
    desired_move_date: "2027-01-26",
    other: null,
  },
  important_dates: [{ date: "2026-10-28", description: "Megtekintés" }],
  decisions: ["Ingatlanokat küldök"],
  open_questions: ["Kell-e parkoló?"],
  promised_actions: [],
  tasks: [],
  follow_up_date: "2026-10-30",
  follow_up_time: null,
  outcome: "Érdeklődik",
};

const existing: ClientSnapshot = {
  id: "00000000-0000-0000-0000-000000000001",
  full_name: "Teszt Péter",
  phone: "+36 30 123 4567",
  email: null,
  budget_min: 70_000_000,
  budget_max: 85_000_000,
  preferred_locations: ["Budapest XI. kerület"],
  preferred_property_types: [],
  min_rooms: 2.5,
  min_bedrooms: null,
  min_area_sqm: null,
  max_area_sqm: null,
  desired_move_date: null,
  other_requirements: null,
  next_follow_up_at: null,
};

const byKey = (fields: ReturnType<typeof proposedFields>) => Object.fromEntries(fields.map((f) => [f.key, f]));

describe("proposedFields", () => {
  it("for a new client, proposes everything found and flags no conflicts", () => {
    const f = byKey(proposedFields(extraction, null));
    expect(Object.keys(f).sort()).toEqual(
      ["budget_max", "desired_move_date", "min_bedrooms", "phone", "preferred_locations", "preferred_property_types"].sort(),
    );
    expect(Object.values(f).every((x) => !x.conflict)).toBe(true);
    expect(f.budget_max.label).toBe("Költségkeret (kb.)");
  });

  it("marks a different saved value as a conflict so it is not overwritten by default", () => {
    const f = byKey(proposedFields(extraction, existing));
    expect(f.budget_max.conflict).toBe(true);
    expect(f.budget_max.current?.replace(/\s/g, " ")).toBe("85 000 000 Ft");
  });

  it("skips values that are already saved and fills empty ones without conflict", () => {
    const f = byKey(proposedFields(extraction, existing));
    expect(f.phone).toBeUndefined(); // same phone already saved
    expect(f.min_bedrooms.conflict).toBe(false);
    expect(f.desired_move_date.conflict).toBe(false);
  });

  it("treats different spellings of the same district as one location", () => {
    expect(new Set(["Budapest XI.", "Budapest XI. kerület", "XI. ker.", "budapest xi kerulet"].map(locationKey)).size).toBe(1);
    expect(locationKey("Budaörs")).not.toBe(locationKey("Budapest XI."));
    const f = byKey(proposedFields({ ...extraction, requirements: { ...extraction.requirements, locations: ["Budapest XI. kerület"] } }, { ...existing, preferred_locations: ["Budapest XI."] }));
    expect(f.preferred_locations).toBeUndefined();
  });

  it("merges locations instead of replacing them", () => {
    const f = byKey(proposedFields(extraction, existing));
    expect(f.preferred_locations.proposed).toBe("Budapest XI. kerület, Budaörs");
    expect(f.preferred_locations.conflict).toBe(false);
  });

  it("proposes nothing when the note adds nothing new", () => {
    const sameAsSaved = proposedFields(
      { ...extraction, client: { ...extraction.client, phone: existing.phone }, requirements: { ...extraction.requirements, budget_max: null, locations: ["budapest xi. kerület"], property_types: [], min_bedrooms: null, desired_move_date: null } },
      existing,
    );
    expect(sameAsSaved).toEqual([]);
  });
});

describe("toUpdateValue", () => {
  const field = (kind: "money" | "int" | "list" | "types") => ({ key: "budget_max" as const, label: "Mező", kind, proposed: "", current: null, conflict: false });

  it("parses Hungarian number input", () => {
    expect(toUpdateValue(field("money"), "79,5 M")).toEqual({ ok: true, value: 79_500_000 });
    expect(toUpdateValue(field("money"), "")).toEqual({ ok: true, value: null });
    expect(toUpdateValue(field("money"), "sok")).toEqual({ ok: false, error: "Mező: számot adj meg." });
    expect(toUpdateValue(field("int"), "1,5")).toEqual({ ok: false, error: "Mező: egész számot adj meg." });
  });

  it("splits lists", () => {
    expect(toUpdateValue(field("list"), "Budaörs, Budakeszi;  ")).toEqual({ ok: true, value: ["Budaörs", "Budakeszi"] });
    expect(toUpdateValue(field("types"), "apartment,house")).toEqual({ ok: true, value: ["apartment", "house"] });
  });
});

describe("outcomeText", () => {
  it("keeps decisions, open questions and dates in the saved record", () => {
    expect(outcomeText(extraction)).toBe(
      "Érdeklődik\nMegállapodás: Ingatlanokat küldök\nNyitott kérdések: Kell-e parkoló?\nFontos dátumok: 2026. okt. 28. – Megtekintés",
    );
  });
});
