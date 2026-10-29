import { describe, expect, it } from "vitest";
import { buildListingFeed, xmlEscape, type FeedListing } from "@/lib/portal/feed-xml";

const listing: FeedListing = {
  id: "p1",
  reference: "TESZT-001",
  title: "Napfényes 2 szobás <erkéllyel> & kilátással",
  property_type: "apartment",
  listing_type: "sale",
  status: "active",
  country: "HU",
  city: "Budapest",
  district: "XI. kerület",
  postal_code: "1117",
  price: 79_900_000,
  currency: "HUF",
  area_sqm: 54.5,
  room_count: 2,
  bedroom_count: null,
  bathroom_count: 1,
  floor: "3",
  building_type: null,
  condition: "felújított",
  energy_rating: null,
  has_balcony: true,
  has_garden: null,
  has_parking: false,
  description: "Első sor\nMásodik \u0001sor",
  updated_at: "2026-10-29T10:00:00Z",
  agent: { name: "Teszt Ügynök", email: "agent@example.com" },
  photos: ["m1", "m2"],
};

describe("buildListingFeed", () => {
  const xml = buildListingFeed({ agency: "Teszt & Társa", listings: [listing], photoUrl: (id) => `https://x.test/api/feed/T/photo/${id}`, now: new Date("2026-10-29T12:00:00Z") });

  it("writes the listing's fields, escaped, and leaves out empty ones", () => {
    expect(xml).toContain('<listings generator="Flavio" version="1" agency="Teszt &amp; Társa" generated="2026-10-29T12:00:00.000Z" count="1">');
    expect(xml).toContain("<title>Napfényes 2 szobás &lt;erkéllyel&gt; &amp; kilátással</title>");
    expect(xml).toContain('<price currency="HUF">79900000</price>');
    expect(xml).toContain('<area unit="sqm">54.5</area>');
    expect(xml).toContain("<balcony>true</balcony>");
    expect(xml).toContain("<parking>false</parking>");
    expect(xml).not.toContain("<bedrooms>");
    expect(xml).not.toContain("<garden>");
    expect(xml).toContain("<photos><photo>https://x.test/api/feed/T/photo/m1</photo><photo>https://x.test/api/feed/T/photo/m2</photo></photos>");
    expect(xml).toContain("<contact><name>Teszt Ügynök</name><email>agent@example.com</email></contact>");
  });

  it("drops characters XML does not allow", () => {
    expect(xml).toContain("<description>Első sor\nMásodik sor</description>");
  });

  it("is an empty list without listings", () => {
    expect(buildListingFeed({ agency: "A", listings: [], photoUrl: String })).toMatch(/count="0">\n<\/listings>/);
  });
});

describe("xmlEscape", () => {
  it("escapes quotes for attributes", () => {
    expect(xmlEscape(`a"b'c`)).toBe("a&quot;b&apos;c");
  });
});
