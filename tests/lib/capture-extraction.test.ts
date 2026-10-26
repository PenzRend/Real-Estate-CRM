import { describe, expect, it } from "vitest";
import { z } from "zod";
import { captureUserPrompt, relativeDayTable } from "@/lib/ai/capture-prompt";
import { captureExtractionSchema, cleanExtraction, type CaptureExtraction } from "@/lib/ai/capture-schema";

function extraction(overrides: Partial<CaptureExtraction> = {}): CaptureExtraction {
  return {
    interaction_type: "call",
    summary: "  Péter 2 hálós lakást keres.  ",
    client: { full_name: " Péter ", phone: null, email: " Peter@Example.TEST ", client_type: "buyer" },
    requirements: {
      budget_min: null,
      budget_max: 80_000_000,
      budget_is_approximate: true,
      locations: ["Budapest XI. kerület", " Budapest XI. kerület ", ""],
      property_types: ["apartment", "apartment"],
      min_rooms: null,
      min_bedrooms: 2,
      min_area_sqm: null,
      max_area_sqm: null,
      desired_move_date: "2027-01-26",
      other: " ",
    },
    important_dates: [],
    decisions: [],
    open_questions: [],
    promised_actions: ["Megfelelő ingatlanokat küldök"],
    tasks: [
      { title: "Megfelelő ingatlanok küldése", due_date: null, due_time: null },
      { title: "Visszahívni", due_date: "2026-10-30", due_time: "10:00" },
    ],
    follow_up_date: "2026-10-30",
    follow_up_time: null,
    outcome: null,
    ...overrides,
  };
}

describe("cleanExtraction", () => {
  it("trims, lowercases email and removes duplicates and empty values", () => {
    const x = cleanExtraction(extraction());
    expect(x.summary).toBe("Péter 2 hálós lakást keres.");
    expect(x.client.full_name).toBe("Péter");
    expect(x.client.email).toBe("peter@example.test");
    expect(x.requirements.locations).toEqual(["Budapest XI. kerület"]);
    expect(x.requirements.property_types).toEqual(["apartment"]);
    expect(x.requirements.other).toBeNull();
  });

  it("drops malformed dates, times and non-positive numbers instead of guessing", () => {
    const x = cleanExtraction(
      extraction({
        follow_up_date: "jövő péntek",
        follow_up_time: "10:00",
        tasks: [{ title: "Visszahívni", due_date: "2026-13-45", due_time: "25:00" }],
        important_dates: [{ date: "holnap", description: "Megtekintés" }],
        requirements: { ...extraction().requirements, min_bedrooms: 0, budget_max: -5, desired_move_date: "nemsokára" },
      }),
    );
    expect(x.follow_up_date).toBeNull();
    expect(x.follow_up_time).toBeNull();
    expect(x.tasks).toEqual([{ title: "Visszahívni", due_date: null, due_time: null }]);
    expect(x.important_dates).toEqual([]);
    expect(x.requirements.min_bedrooms).toBeNull();
    expect(x.requirements.budget_max).toBeNull();
    expect(x.requirements.desired_move_date).toBeNull();
  });

  it("swaps an inverted budget range", () => {
    const x = cleanExtraction(
      extraction({ requirements: { ...extraction().requirements, budget_min: 90_000_000, budget_max: 70_000_000 } }),
    );
    expect([x.requirements.budget_min, x.requirements.budget_max]).toEqual([70_000_000, 90_000_000]);
  });
});

describe("captureExtractionSchema", () => {
  it("converts to a JSON schema every provider can enforce", () => {
    const schema = z.toJSONSchema(captureExtractionSchema) as { required?: string[]; properties?: object };
    // Strict structured output needs every property listed as required.
    expect(schema.required).toEqual(Object.keys(schema.properties ?? {}));
  });
});

describe("captureUserPrompt", () => {
  it("gives the model today's date in Budapest, including after the DST switch", () => {
    // 2026-10-25 23:30 UTC is already Monday 26 October 00:30 in Budapest.
    const prompt = captureUserPrompt("Hívjam vissza pénteken.", new Date("2026-10-25T23:30:00Z"), "Teszt Péter");
    expect(prompt).toContain("Current date: 2026-10-26 (hétfő)");
    expect(prompt).toContain('client "Teszt Péter"');
    expect(prompt).toContain("<note>\nHívjam vissza pénteken.\n</note>");
  });
});

describe("relativeDayTable", () => {
  const line = (table: string, key: string) => table.split("\n").find((l) => l.startsWith(key));

  it("on a Monday, 'kedden' is tomorrow and 'jövő kedden' is next week's Tuesday", () => {
    const t = relativeDayTable(new Date("2026-10-26T10:00:00Z")); // Monday
    expect(line(t, "kedden")).toBe("kedden = 2026-10-27; jövő kedden = 2026-11-03");
    expect(line(t, "pénteken")).toBe("pénteken = 2026-10-30; jövő pénteken = 2026-11-06");
    expect(line(t, "hétfőn")).toBe("hétfőn = 2026-11-02; jövő hétfőn = 2026-11-02");
    expect(line(t, "holnapután")).toBe("holnapután = 2026-10-28");
    expect(line(t, "jövő héten")).toContain("2026-11-02 – 2026-11-08");
  });

  it("on a Thursday, 'kedden' and 'jövő kedden' are both next week's Tuesday", () => {
    const t = relativeDayTable(new Date("2026-10-29T10:00:00Z")); // Thursday
    expect(line(t, "kedden")).toBe("kedden = 2026-11-03; jövő kedden = 2026-11-03");
    expect(line(t, "pénteken")).toBe("pénteken = 2026-10-30; jövő pénteken = 2026-11-06");
    expect(line(t, "hétvégén")).toBe("hétvégén = 2026-10-31");
  });

  it("uses the Budapest date, not UTC, late in the evening", () => {
    // 23:30 UTC on Sunday 25 Oct is already Monday 26 Oct in Budapest.
    const t = relativeDayTable(new Date("2026-10-25T23:30:00Z"));
    expect(line(t, "ma =")).toBe("ma = 2026-10-26");
  });
});
