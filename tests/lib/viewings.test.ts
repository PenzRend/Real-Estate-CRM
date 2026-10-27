import { describe, expect, it } from "vitest";
import { awaitingFeedback, cleanProposedTimes, defaultSlot, fillTimePlaceholders, followUpFor, relationFor, spokenTime } from "@/lib/viewings/logic";

const now = new Date("2026-10-27T10:00:00Z"); // Tuesday, 11:00 in Budapest

describe("proposed times from an email", () => {
  it("keeps well-formed future times within a few months, sorted and unique", () => {
    expect(cleanProposedTimes(["2026-11-03T17:00", "2026-10-29T09:30", "2026-11-03T17:00"], now)).toEqual(["2026-10-29T09:30", "2026-11-03T17:00"]);
  });

  it("drops past, malformed, impossible and far-off times", () => {
    expect(cleanProposedTimes(["2026-10-26T17:00", "kedd 17:00", "2026-02-30T10:00", "2027-06-01T10:00", 42, null], now)).toEqual([]);
    expect(cleanProposedTimes("2026-11-03T17:00", now)).toEqual([]);
  });

  it("defaults to tomorrow 17:00 Budapest time", () => {
    expect(defaultSlot(now)).toBe("2026-10-28T17:00");
  });
});

describe("feedback", () => {
  const names = { client: "Kata", property: "Bartók lakás" };

  it("waits for feedback once the viewing has ended", () => {
    const v = { status: "scheduled" as const, startsAt: "2026-10-27T09:00:00Z", durationMinutes: 45 };
    expect(awaitingFeedback(v, now)).toBe(true);
    expect(awaitingFeedback({ ...v, durationMinutes: 90 }, now)).toBe(false);
    expect(awaitingFeedback({ ...v, status: "completed" }, now)).toBe(false);
  });

  it("leaves the right follow-up for each answer", () => {
    expect(followUpFor("high", names, now)).toEqual({ title: "Ajánlat vagy második megtekintés: Bartók lakás → Kata", dueAt: "2026-10-28T10:00:00.000Z" });
    expect(followUpFor("medium", names, now)?.dueAt).toBe("2026-10-29T10:00:00.000Z");
    expect(followUpFor("no_show", names, now)?.title).toMatch(/^Új időpont egyeztetése/);
    expect(followUpFor("low", names, now)).toBeNull();
    expect(followUpFor("none", names, now)).toBeNull();
  });

  it("records the client's relation to the listing", () => {
    expect(relationFor("high")).toBe("viewed");
    expect(relationFor("none")).toBe("rejected");
    expect(relationFor("no_show")).toBeNull();
  });
});

describe("confirming the time in a reply", () => {
  it("fills time placeholders with the booked time", () => {
    const when = spokenTime("2026-11-03T16:00:00Z");
    expect(when).toBe("november 3., kedd 17:00");
    expect(fillTimePlaceholders("Várom Önt [időpont]-kor, címe: [cím].", when)).toBe("Várom Önt november 3., kedd 17:00-kor, címe: [cím].");
  });
});
