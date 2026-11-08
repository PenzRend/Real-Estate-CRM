import { describe, expect, it } from "vitest";
import { freeSlots } from "@/lib/booking/slots";

const settings = { days: [1, 2, 3, 4, 5], startMinute: 9 * 60, endMinute: 12 * 60, slotMinutes: 60, noticeHours: 12, horizonDays: 7 };

describe("freeSlots", () => {
  // Sunday 8 November 2026, 10:00 Budapest (09:00 UTC).
  const now = new Date("2026-11-08T09:00:00Z");

  it("offers the working days' slots in Budapest time, after the notice", () => {
    const days = freeSlots(settings, [], now);
    expect(days[0]).toEqual({
      date: "2026-11-09",
      slots: [
        { start: "2026-11-09T08:00:00.000Z", label: "09:00" },
        { start: "2026-11-09T09:00:00.000Z", label: "10:00" },
        { start: "2026-11-09T10:00:00.000Z", label: "11:00" },
      ],
    });
    expect(days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
  });

  it("leaves out slots that overlap another viewing, and those too soon", () => {
    const busy = [{ start: "2026-11-09T09:30:00.000Z", minutes: 45 }];
    expect(freeSlots(settings, busy, now)[0].slots.map((s) => s.label)).toEqual(["09:00"]);
    // Monday 08:30 Budapest: with 12 hours' notice nothing on Monday is left.
    expect(freeSlots(settings, [], new Date("2026-11-09T07:30:00Z"))[0].date).toBe("2026-11-10");
  });
});
