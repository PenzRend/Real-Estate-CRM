import { describe, expect, it } from "vitest";
import { laterChoices } from "@/lib/mail/later";

describe("laterChoices", () => {
  it("offers an hour, this evening, tomorrow morning and Monday morning in Budapest time", () => {
    // Thursday 12 November 2026, 10:00 Budapest.
    const c = laterChoices(new Date("2026-11-12T09:00:00Z"));
    expect(c.map((x) => [x.label, x.at])).toEqual([
      ["1 óra múlva", "2026-11-12T10:00:00.000Z"],
      ["Ma 17:00", "2026-11-12T16:00:00.000Z"],
      ["Holnap 9:00", "2026-11-13T08:00:00.000Z"],
      ["Hétfő 9:00", "2026-11-16T08:00:00.000Z"],
    ]);
  });
  it("drops this evening late in the day, and Monday when tomorrow is Monday", () => {
    // Sunday 8 November 2026, 18:00 Budapest.
    expect(laterChoices(new Date("2026-11-08T17:00:00Z")).map((x) => x.label)).toEqual(["1 óra múlva", "Holnap 9:00"]);
  });
});
