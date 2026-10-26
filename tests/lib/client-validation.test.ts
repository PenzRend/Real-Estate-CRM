import { describe, expect, it } from "vitest";
import { startOfZonedDay, utcToZonedLocal, zonedLocalToUtc } from "@/lib/i18n/timezone";
import { searchTerm } from "@/lib/search";
import { parseClientForm, parseHungarianNumber } from "@/lib/validation/client";

function form(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
}

const base = { full_name: "Teszt Péter", client_type: "buyer", status: "new_lead" };

describe("parseHungarianNumber", () => {
  it.each([
    ["80 000 000", 80_000_000],
    ["80.000.000", 80_000_000],
    ["80 000 000 Ft", 80_000_000],
    ["80M", 80_000_000],
    ["79,5 M Ft", 79_500_000],
    ["64,5", 64.5],
    ["64.5", 64.5],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(parseHungarianNumber(input)).toBe(expected);
  });

  it("rejects text", () => {
    expect(parseHungarianNumber("sok")).toBeNaN();
  });
});

describe("Budapest time conversion", () => {
  it("handles winter (CET) and summer (CEST)", () => {
    expect(zonedLocalToUtc("2026-12-01T10:00")).toBe("2026-12-01T09:00:00.000Z");
    expect(zonedLocalToUtc("2026-07-01T10:00")).toBe("2026-07-01T08:00:00.000Z");
  });

  it("round-trips through the datetime-local format", () => {
    expect(utcToZonedLocal("2026-10-30T09:00:00.000Z")).toBe("2026-10-30T10:00");
    expect(utcToZonedLocal(zonedLocalToUtc("2026-03-29T12:30"))).toBe("2026-03-29T12:30");
  });

  it("finds the start of the Budapest day across the October DST switch", () => {
    // 2026-10-25 23:30 CET; that day began at 00:00 CEST (UTC+2), the next at 00:00 CET (UTC+1).
    expect(startOfZonedDay(new Date("2026-10-25T22:30:00Z")).toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(startOfZonedDay(new Date("2026-10-25T22:30:00Z"), undefined, 1).toISOString()).toBe(
      "2026-10-25T23:00:00.000Z",
    );
  });

  it("rejects malformed input", () => {
    expect(zonedLocalToUtc("tomorrow")).toBeNull();
  });
});

describe("parseClientForm", () => {
  it("accepts a minimal client and normalizes empty fields to null", () => {
    const r = parseClientForm(form({ ...base, email: " ", phone: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({ full_name: "Teszt Péter", email: null, phone: null, budget_min: null, preferred_locations: [] });
    }
  });

  it("parses requirements as typed by an agent", () => {
    const r = parseClientForm(
      form({
        ...base,
        email: "Peter@Example.TEST",
        phone: "+36 30 123 4567",
        budget_min: "70 M",
        budget_max: "85 000 000",
        preferred_locations: "Budapest XI., Budaörs, Budapest XI.",
        preferred_property_types: ["apartment", "house"],
        min_rooms: "2,5",
        next_follow_up_at: "2026-10-30T10:00",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        email: "peter@example.test",
        budget_min: 70_000_000,
        budget_max: 85_000_000,
        preferred_locations: ["Budapest XI.", "Budaörs"],
        preferred_property_types: ["apartment", "house"],
        min_rooms: 2.5,
        next_follow_up_at: "2026-10-30T09:00:00.000Z",
      });
    }
  });

  it("reports Hungarian field errors", () => {
    const r = parseClientForm(
      form({ ...base, full_name: " ", email: "nem-email", client_type: "alien" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.full_name).toBe("Add meg az ügyfél nevét.");
      expect(r.errors.email).toBe("Érvénytelen e-mail-cím.");
      expect(r.errors.client_type).toBe("Válassz ügyféltípust.");
    }
  });

  it("rejects an inverted budget range", () => {
    const r = parseClientForm(form({ ...base, budget_min: "90M", budget_max: "80M" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.budget_max).toBe("A maximum nem lehet kisebb a minimumnál.");
  });

  it("rejects non-numeric budgets and unknown property types", () => {
    const r = parseClientForm(form({ ...base, budget_min: "sok", preferred_property_types: ["castle"] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.budget_min).toBe("Számot adj meg.");
      expect(r.errors.preferred_property_types).toBeDefined();
    }
  });
});

describe("searchTerm", () => {
  it("drops accents and case so the DB's normalized column matches", () => {
    expect(searchTerm("  Kovács   PÉTER ")).toBe("kovacs peter");
    expect(searchTerm("Őrség Ű")).toBe("orseg u");
  });

  it("strips characters that would change the PostgREST filter", () => {
    expect(searchTerm("a,b)or(id.eq.1*%")).toBe("a b or id.eq.1");
  });
});
