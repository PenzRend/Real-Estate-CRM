import { describe, expect, it } from "vitest";
import {
  buildJofogasFeed,
  hungarianMobile,
  jofogasBody,
  jofogasCategory,
  jofogasEnergy,
  jofogasFloor,
  jofogasHeating,
  jofogasSkipReason,
  jofogasSubject,
  type JofogasListing,
} from "@/lib/portal/jofogas-xml";

const listing = (over: Partial<JofogasListing> = {}): JofogasListing => ({
  id: "0b0c7c8e-1111-4a4a-9b9b-123456789abc",
  reference: "TESZT-1",
  title: "Napfényes 2,5 szobás lakás erkéllyel",
  property_type: "apartment",
  listing_type: "sale",
  status: "active",
  country: "HU",
  city: "Budapest",
  district: "XIII. kerület",
  postal_code: "1133",
  price: 69_900_000,
  currency: "HUF",
  area_sqm: 54,
  room_count: 2.5,
  bedroom_count: 2,
  bathroom_count: 1,
  floor: "3. emelet",
  building_type: "tégla",
  condition: "felújított",
  energy_rating: "BB",
  has_balcony: true,
  has_garden: null,
  has_parking: null,
  description: "<p>Világos, csendes lakás a Pozsonyi út közelében, felújított fürdővel.</p>",
  updated_at: "2026-11-13T10:00:00Z",
  agent: { name: "Teszt Ügynök (Flavio)", email: "teszt@example.test" },
  photos: ["p1", "p2"],
  features: { heating: "gáz cirkó", elevator: true, year_built: 1938 },
  ...over,
});

describe("Jófogás codes", () => {
  it("maps categories", () => {
    expect(jofogasCategory(listing())).toBe(1020);
    expect(jofogasCategory(listing({ property_type: "house", building_type: null }))).toBe(1040);
    expect(jofogasCategory(listing({ property_type: "house", building_type: "ikerház" }))).toBe(1340);
    expect(jofogasCategory(listing({ property_type: "plot" }))).toBe(1060);
    expect(jofogasCategory(listing({ property_type: "commercial" }))).toBe(1080);
    expect(jofogasCategory(listing({ property_type: "other" }))).toBeNull();
  });

  it("maps floors, heating and energy", () => {
    expect(jofogasFloor("földszint")).toBe(1);
    expect(jofogasFloor("magasföldszint")).toBe(2);
    expect(jofogasFloor("3. emelet")).toBe(6);
    expect(jofogasFloor("12")).toBe(14);
    expect(jofogasFloor("tetőtér")).toBe(15);
    expect(jofogasHeating("gáz (cirkó)")).toBe(1);
    expect(jofogasHeating("távfűtés")).toBe(7);
    expect(jofogasHeating("hőszivattyú")).toBe(10);
    expect(jofogasHeating("valami más")).toBe(8);
    expect(jofogasEnergy("A++")).toBe(11);
    expect(jofogasEnergy("C")).toBe(4);
    expect(jofogasEnergy("")).toBeNull();
  });

  it("keeps the subject at 12–70 characters", () => {
    expect(jofogasSubject(listing({ title: "Lakás" }))).toBe("Lakás – Budapest, XIII. kerület");
    expect(jofogasSubject(listing({ title: "x", city: null, district: null }))).toBe("Eladó lakás – x");
    const long = jofogasSubject(listing({ title: "Nagyon hosszú hirdetéscím, amely jóval meghaladja a Jófogás által megengedett hetven karaktert" }));
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long.endsWith("…")).toBe(true);
  });

  it("writes a plain-text body of at least 20 characters", () => {
    expect(jofogasBody(listing())).toBe("Világos, csendes lakás a Pozsonyi út közelében, felújított fürdővel.");
    expect(jofogasBody(listing({ description: null })).length).toBeGreaterThanOrEqual(20);
  });

  it("normalises Hungarian mobile numbers", () => {
    expect(hungarianMobile("06 30 123 4567")).toBe("+36301234567");
    expect(hungarianMobile("+36 (70) 123-4567")).toBe("+36701234567");
    expect(hungarianMobile("06 1 234 5678")).toBeNull();
  });

  it("says why a listing can't go to Jófogás", () => {
    expect(jofogasSkipReason(listing())).toBeNull();
    expect(jofogasSkipReason(listing({ currency: "EUR" }))).toMatch(/forint/);
    expect(jofogasSkipReason(listing({ price: null }))).toMatch(/ár/);
    expect(jofogasSkipReason(listing({ postal_code: null }))).toMatch(/irányítószám/);
  });
});

describe("the Jófogás feed", () => {
  const xml = buildJofogasFeed({
    agency: "TESZT Iroda",
    settings: { partnerId: "100", phone: "+36301234567", email: "iroda@example.test" },
    listings: [listing(), listing({ id: "x2", title: "TESZT eurós villa", currency: "EUR" })],
    photoUrl: (id) => `https://www.flavio.hu/api/feed/t/photo/${id}`,
  });

  it("has the contact block and one item per listing it can take", () => {
    expect(xml).toContain("<partner_id>100</partner_id>");
    expect(xml).toContain("<partner_phone>+36301234567</partner_phone>");
    expect(xml.match(/<item>/g)).toHaveLength(1);
    expect(xml).toContain("<!-- Kihagyva: TESZT eurós villa (a Jófogás csak forintos árat fogad) -->");
  });

  it("writes the codes Jófogás expects", () => {
    for (const part of [
      "<category>1020</category>",
      "<type>s</type>",
      "<price>69900000</price>",
      "<zipcode>1133</zipcode>",
      "<rooms>2</rooms>",
      "<half_room>1</half_room>",
      "<floor>6</floor>",
      "<building_type>1</building_type>",
      "<realestate_condition>6</realestate_condition>",
      "<heating_type>1</heating_type>",
      "<balcony>1</balcony>",
      "<elevator>1</elevator>",
      "<name>Teszt Ügynök Flavio</name>",
      '<image main-image="1">https://www.flavio.hu/api/feed/t/photo/p1</image>',
    ])
      expect(xml).toContain(part);
    expect(xml).not.toContain("<p>");
  });
});
