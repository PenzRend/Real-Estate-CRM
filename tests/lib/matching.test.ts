import { describe, expect, it } from "vitest";
import { matchClientToProperty, matchSummary, wantedFeatures, type MatchClient, type MatchProperty } from "@/lib/matching/match";

const client: MatchClient = {
  id: "c1",
  full_name: "Teszt Péter",
  client_type: "buyer",
  budget_min: 70_000_000,
  budget_max: 85_000_000,
  preferred_locations: ["Budapest XI.", "Budaörs"],
  preferred_property_types: ["apartment"],
  min_rooms: null,
  min_bedrooms: 2,
  min_area_sqm: null,
  max_area_sqm: null,
  other_requirements: "Erkély fontos; Parkoló kérdéses",
};

const property: MatchProperty = {
  id: "p1",
  title: "Napfényes lakás",
  listing_type: "sale",
  property_type: "apartment",
  status: "active",
  city: "Budapest",
  district: "XI. kerület",
  price: 79_000_000,
  currency: "HUF",
  area_sqm: 64,
  room_count: 3,
  bedroom_count: 2,
  has_balcony: true,
  has_garden: false,
  has_parking: null,
};

const statuses = (m: ReturnType<typeof matchClientToProperty>) => Object.fromEntries(m!.checks.map((c) => [c.key, c.status]));

describe("matchClientToProperty", () => {
  it("is a strong match when every stated requirement fits (the brief's example)", () => {
    const m = matchClientToProperty(client, property);
    expect(m?.category).toBe("strong");
    expect(statuses(m)).toEqual({ price: "met", location: "met", type: "met", bedrooms: "met", balcony: "met" });
  });

  it("ignores parking because the client is undecided about it", () => {
    expect(wantedFeatures("Erkély fontos; Parkoló kérdéses").map((f) => f.key)).toEqual(["balcony"]);
    expect(wantedFeatures("Kertvárosi környék; Garázs kell").map((f) => f.key)).toEqual(["parking"]);
  });

  it("calls a price up to 10% over budget close, and further out excluded", () => {
    expect(statuses(matchClientToProperty(client, { ...property, price: 92_000_000 })).price).toBe("close");
    expect(matchClientToProperty(client, { ...property, price: 99_000_000 })).toBeNull();
  });

  it("excludes the wrong place or type, and sellers or rentals for buyers", () => {
    expect(matchClientToProperty(client, { ...property, district: "XIII. kerület" })).toBeNull();
    expect(matchClientToProperty(client, { ...property, property_type: "house" })).toBeNull();
    expect(matchClientToProperty({ ...client, client_type: "seller" }, property)).toBeNull();
    expect(matchClientToProperty(client, { ...property, listing_type: "rent" })).toBeNull();
    expect(matchClientToProperty({ ...client, client_type: "tenant" }, { ...property, listing_type: "rent" })).not.toBeNull();
  });

  it("matches a town by city and a plain 'Budapest' wish by any Budapest district", () => {
    expect(matchClientToProperty(client, { ...property, city: "Budaörs", district: null })?.category).toBe("strong");
    const anywhereInBudapest = { ...client, preferred_locations: ["Budapest"] };
    expect(statuses(matchClientToProperty(anywhereInBudapest, { ...property, district: "II. kerület" })).location).toBe("met");
    expect(matchClientToProperty(anywhereInBudapest, { ...property, city: "Budaörs", district: null })).toBeNull();
  });

  it("does not confuse district XI with district I or II", () => {
    expect(matchClientToProperty(client, { ...property, district: "I. kerület" })).toBeNull();
    expect(matchClientToProperty({ ...client, preferred_locations: ["Budapest I."] }, property)).toBeNull();
  });

  it("downgrades for missing listing data instead of guessing", () => {
    const m = matchClientToProperty(client, { ...property, bedroom_count: null, has_balcony: null });
    expect(m?.category).toBe("good");
    expect(statuses(m)).toMatchObject({ bedrooms: "unknown", balcony: "unknown" });
    // An unknown price is never "good": the budget is the main hard requirement.
    expect(matchClientToProperty(client, { ...property, price: null })?.category).toBe("possible");
  });

  it("shows soft misses but still lists the property", () => {
    const m = matchClientToProperty(client, { ...property, bedroom_count: 1, has_balcony: false });
    expect(m?.category).toBe("good");
    expect(matchSummary(m!)).toBe("Illik: ár, helyszín, típus; ellenőrizd: hálószobák, erkély / terasz.");
  });

  it("never offers a client their own property", () => {
    expect(matchClientToProperty(client, { ...property, owner_client_id: "c1" })).toBeNull();
    expect(matchClientToProperty(client, { ...property, owner_client_id: "someone-else" })?.category).toBe("strong");
  });

  it("says nothing for a client without budget, location or type", () => {
    expect(
      matchClientToProperty({ ...client, budget_min: null, budget_max: null, preferred_locations: [], preferred_property_types: [] }, property),
    ).toBeNull();
  });
});
