import { describe, expect, it } from "vitest";
import { calendarQuery, decodeXml, hrefIn, nearestColor, parseCalendarData, parseCalendars } from "@/lib/calendar/caldav-xml";
import { monthGrid } from "@/lib/calendar/week";

// Shaped like iCloud's replies (its own namespace prefixes and Apple's colour property).
const HOME = `<?xml version="1.0" encoding="UTF-8"?>
<multistatus xmlns="DAV:">
  <response>
    <href>/1234567/calendars/</href>
    <propstat><prop><resourcetype><collection/></resourcetype><displayname>Home</displayname></prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/1234567/calendars/home/</href>
    <propstat><prop>
      <resourcetype><collection/><calendar xmlns="urn:ietf:params:xml:ns:caldav"/></resourcetype>
      <displayname>Otthon &amp; család</displayname>
      <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name="VEVENT"/></supported-calendar-component-set>
      <calendar-color xmlns="http://apple.com/ns/ical/">#FF2968FF</calendar-color>
    </prop><status>HTTP/1.1 200 OK</status></propstat>
  </response>
  <response>
    <href>/1234567/calendars/tasks/</href>
    <propstat><prop>
      <resourcetype><collection/><C:calendar xmlns:C="urn:ietf:params:xml:ns:caldav"/></resourcetype>
      <displayname>Emlékeztetők</displayname>
      <C:supported-calendar-component-set xmlns:C="urn:ietf:params:xml:ns:caldav"><C:comp name="VTODO"/></C:supported-calendar-component-set>
    </prop></propstat>
  </response>
  <response>
    <href>/1234567/calendars/work/</href>
    <propstat><prop><resourcetype><collection/><cal:calendar xmlns:cal="urn:ietf:params:xml:ns:caldav"/></resourcetype><displayname>Munka</displayname></prop></propstat>
  </response>
</multistatus>`;

describe("CalDAV replies", () => {
  it("finds the principal and the calendar home", () => {
    const xml = `<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>/1234567/principal/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>`;
    expect(hrefIn(xml, "current-user-principal")).toBe("/1234567/principal/");
    const home = `<multistatus xmlns="DAV:"><response><propstat><prop><calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href xmlns="DAV:">https://p42-caldav.icloud.com:443/1234567/calendars/</href></calendar-home-set></prop></propstat></response></multistatus>`;
    expect(hrefIn(home, "calendar-home-set")).toBe("https://p42-caldav.icloud.com:443/1234567/calendars/");
    expect(hrefIn("<multistatus/>", "current-user-principal")).toBeNull();
  });

  it("lists the event calendars, not the folder itself or reminders", () => {
    expect(parseCalendars(HOME)).toEqual([
      { href: "/1234567/calendars/home/", name: "Otthon & család", color: "#FF2968FF" },
      { href: "/1234567/calendars/work/", name: "Munka", color: null },
    ]);
  });

  it("reads the events' iCal data, unescaped", () => {
    const xml = `<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav"><d:response><d:propstat><d:prop><cal:calendar-data>BEGIN:VCALENDAR&#13;
SUMMARY:Tárgyalás &lt;fontos&gt;&#13;
END:VCALENDAR</cal:calendar-data></d:prop></d:propstat></d:response><d:response><d:propstat><d:prop><cal:calendar-data><![CDATA[BEGIN:VCALENDAR
END:VCALENDAR]]></cal:calendar-data></d:prop></d:propstat></d:response></d:multistatus>`;
    const docs = parseCalendarData(xml);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toContain("SUMMARY:Tárgyalás <fontos>");
    expect(decodeXml("a &amp;amp; b")).toBe("a &amp; b");
  });

  it("asks for a UTC time range and maps colours to Flavio's", () => {
    expect(calendarQuery(new Date("2026-10-26T23:00:00Z"), new Date("2026-12-06T23:00:00Z"))).toContain('start="20261026T230000Z" end="20261206T230000Z"');
    expect(nearestColor("#FF2968FF", "sky")).toBe("rose");
    expect(nearestColor("#1BADF8", "slate")).toBe("sky");
    expect(nearestColor(null, "amber")).toBe("amber");
  });
});

describe("the month grid", () => {
  it("covers whole weeks from Monday, 5 or 6 rows", () => {
    const nov = monthGrid("2026-11", new Date());
    expect(nov.days[0]).toBe("2026-10-26");
    expect(nov.days.at(-1)).toBe("2026-12-06");
    expect(nov.days).toHaveLength(42);
    expect(nov.previous).toBe("2026-10");
    expect(nov.next).toBe("2026-12");
    expect(nov.inMonth("2026-10-31")).toBe(false);
    expect(nov.from.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    const feb = monthGrid("2027-02", new Date());
    expect(feb.days).toHaveLength(28); // 1 February 2027 is a Monday
    expect(monthGrid("2026-12", new Date()).next).toBe("2027-01");
    expect(monthGrid("bad", new Date("2026-10-29T10:00:00Z")).key).toBe("2026-10");
  });
});
