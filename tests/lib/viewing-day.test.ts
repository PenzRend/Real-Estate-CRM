import { describe, expect, it } from "vitest";
import { dayRoute, lateText, morningMessage, smsLink, todaysViewings, type DayViewing } from "@/lib/viewings/day";

const v = (id: string, startsAt: string, address: string | null, status = "scheduled"): DayViewing => ({
  id,
  startsAt,
  durationMinutes: 45,
  status,
  location: null,
  client: { name: `Ügyfél ${id}`, phone: "+36 30 123 4567" },
  property: { name: `Ingatlan ${id}`, address },
});

describe("viewing day", () => {
  // Tuesday 10 November 2026, 09:00 Budapest.
  const now = new Date("2026-11-10T08:00:00Z");
  const list = [
    v("b", "2026-11-10T13:00:00Z", "1052 Budapest, Váci utca 1."),
    v("a", "2026-11-10T09:00:00Z", "1117 Budapest, Bartók Béla út 10."),
    v("late-night", "2026-11-10T23:30:00Z", "x"), // 00:30 on the 11th in Budapest
    v("c", "2026-11-10T15:00:00Z", "Budaörs, Fő utca 2.", "cancelled"),
  ];

  it("keeps today's scheduled viewings in Budapest time, in order", () => {
    expect(todaysViewings(list, now).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("builds the day's route from the stops still ahead", () => {
    const today = todaysViewings(list, now);
    expect(dayRoute(today, now)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=1052%20Budapest%2C%20V%C3%A1ci%20utca%201.&waypoints=1117%20Budapest%2C%20Bart%C3%B3k%20B%C3%A9la%20%C3%BAt%2010.&travelmode=driving",
    );
    // After the first viewing, only one stop is left: no route.
    expect(dayRoute(today, new Date("2026-11-10T10:00:00Z"))).toBeNull();
  });

  it("writes the late text, the SMS link and the morning line", () => {
    expect(lateText("Kiss Anna")).toBe("Jó napot! Kb. 10 perc késéssel érkezem a megtekintésre, elnézést kérek! – Kiss Anna");
    expect(smsLink("+36 30 123 4567", "Késem")).toBe("sms:+36301234567?&body=K%C3%A9sem");
    expect(morningMessage(todaysViewings(list, now), 4)).toEqual({ title: "Jó reggelt! Ma:", body: "2 megtekintés, az első 10:00 – 1117 Budapest · 4 teendő" });
    expect(morningMessage([], 0)).toBeNull();
  });
});
