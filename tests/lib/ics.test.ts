import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, icsTime } from "@/lib/calendar/ics";

describe("ics", () => {
  it("escapes text values", () => {
    expect(escapeText("Kiss Éva; 2,5 szobás\\lakás\nmásodik sor")).toBe(String.raw`Kiss Éva\; 2\,5 szobás\\lakás\nmásodik sor`);
  });

  it("writes UTC times", () => {
    expect(icsTime(new Date("2026-11-03T16:00:00.000Z"))).toBe("20261103T160000Z");
  });

  it("folds long lines at 75 bytes without splitting accented letters", () => {
    const line = `SUMMARY:${"Megtekintés: Kovács Éva – Napfényes őrmezői lakás ".repeat(3)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
  });

  it("builds a calendar with confirmed and cancelled events", () => {
    const ics = buildIcs({
      name: "Flavio – Iroda",
      now: new Date("2026-10-27T10:00:00Z"),
      events: [
        {
          uid: "viewing-1@flavio.hu",
          start: new Date("2026-11-03T16:00:00Z"),
          end: new Date("2026-11-03T16:45:00Z"),
          summary: "Megtekintés: Kiss Éva – Lakás",
          location: "1117 Budapest, XI. kerület",
          description: "Telefon: +36 30 123 4567",
          updated: new Date("2026-10-27T09:00:00Z"),
        },
        { uid: "viewing-2@flavio.hu", start: new Date("2026-11-04T09:00:00Z"), end: new Date("2026-11-04T09:30:00Z"), summary: "Lemondott", cancelled: true, updated: new Date() },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261103T160000Z\r\nDTEND:20261103T164500Z");
    expect(ics).toContain(String.raw`LOCATION:1117 Budapest\, XI. kerület`);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
