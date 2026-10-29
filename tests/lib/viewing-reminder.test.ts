import { describe, expect, it } from "vitest";
import { mapsUrl, reminderEmail } from "@/lib/viewings/reminder";

describe("day-before viewing reminder", () => {
  it("gives the time in Budapest, the place with a map link, and the answer link", () => {
    const { subject, body } = reminderEmail({
      clientName: "Kiss Éva",
      startsAt: "2026-11-03T16:00:00.000Z", // 17:00 in Budapest
      durationMinutes: 45,
      propertyTitle: "Napfényes 2 hálós lakás",
      place: "Budapest, Bartók Béla út 10.",
      link: "https://flavio.hu/v/abc",
      agentName: "Orosz Géza",
      agentPhone: "+36 30 123 4567",
    });
    expect(subject).toBe("Holnap 17:00 – megtekintés: Napfényes 2 hálós lakás");
    expect(body).toContain("Kedves Kiss Éva!");
    expect(body).toContain("holnap (november 3., kedd) 17:00-kor");
    expect(body).toContain("Cím: Budapest, Bartók Béla út 10.");
    expect(body).toContain(`Térkép: ${mapsUrl("Budapest, Bartók Béla út 10.")}`);
    expect(body).toContain("https://flavio.hu/v/abc");
    expect(body).toContain("hívjon nyugodtan: +36 30 123 4567");
  });

  it("leaves out the place when there is none, and asks for a reply instead of a call", () => {
    const { body } = reminderEmail({ clientName: "X", startsAt: "2026-11-03T16:00:00.000Z", durationMinutes: 30, propertyTitle: "Ház", place: null, link: "L", agentName: "A", agentPhone: null });
    expect(body).not.toContain("Térkép");
    expect(body).toContain("válaszoljon erre a levélre");
  });
});
