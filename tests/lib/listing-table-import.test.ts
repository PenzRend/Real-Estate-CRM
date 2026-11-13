import { describe, expect, it } from "vitest";
import { guessListingRoles, parseFlag, parsePropertyType, parseRooms, parseStatus, rowToListing } from "@/lib/import/listings";

describe("listing columns", () => {
  it("recognises Hungarian and English headers", () => {
    expect(
      guessListingRoles(["Azonosító", "Hirdetés címe", "Típus", "Eladó/kiadó", "Város", "Kerület", "Cím", "Ár", "Alapterület (m²)", "Szobák", "Hálószoba", "Épület típusa", "Állapot", "Erkély", "Fűtés", "Tulajdonos neve"]),
    ).toEqual(["reference", "title", "type", "listing_type", "city", "district", "address", "price", "area", "rooms", "bedrooms", "building_type", "condition", "balcony", "heating", "skip"]);
    expect(guessListingRoles(["ID", "Title", "City", "Price", "Size", "Rooms", "Status"])).toEqual(["reference", "title", "city", "price", "area", "rooms", "status"]);
  });
});

describe("listing values", () => {
  it("reads Hungarian room counts with half rooms", () => {
    expect(parseRooms("3")).toBe(3);
    expect(parseRooms("2,5")).toBe(2.5);
    expect(parseRooms("2+1")).toBe(2.5);
    expect(parseRooms("2 + 1 fél")).toBe(2.5);
    expect(parseRooms("")).toBeNull();
  });

  it("reads yes/no columns", () => {
    expect(parseFlag("van")).toBe(true);
    expect(parseFlag("Igen")).toBe(true);
    expect(parseFlag("x")).toBe(true);
    expect(parseFlag("nincs")).toBe(false);
    expect(parseFlag("0")).toBe(false);
    expect(parseFlag("2 db beálló")).toBe(true);
    expect(parseFlag("")).toBeNull();
  });

  it("maps types and statuses", () => {
    expect(parsePropertyType("Tégla lakás")).toBe("apartment");
    expect(parsePropertyType("Családi ház")).toBe("house");
    expect(parsePropertyType("Építési telek")).toBe("plot");
    expect(parsePropertyType("Iroda")).toBe("commercial");
    expect(parseStatus("")).toBe("active");
    expect(parseStatus("Eladva")).toBe("sold");
    expect(parseStatus("Foglalózva")).toBe("reserved");
  });
});

describe("a row becomes a listing", () => {
  const roles = guessListingRoles(["Azonosító", "Típus", "Város", "Kerület", "Ár", "m²", "Szobák", "Erkély", "Lift", "Építés éve"]);

  it("builds a headline when there is no title column", () => {
    const l = rowToListing(["TESZT-01", "lakás", "Budapest", "XI. kerület", "79,9 M", "65", "2+1", "van", "igen", "1975"], roles);
    expect(l).toMatchObject({
      title: "2,5 szobás lakás – Budapest, XI. kerület",
      reference_number: "TESZT-01",
      property_type: "apartment",
      listing_type: "sale",
      status: "active",
      price: 79_900_000,
      currency: "HUF",
      area_sqm: 65,
      room_count: 2.5,
      has_balcony: true,
      features: { elevator: true, year_built: 1975 },
    });
  });

  it("keeps a rent as the amount itself, not millions", () => {
    const r = guessListingRoles(["Megnevezés", "Eladó/kiadó", "Ár"]);
    expect(rowToListing(["TESZT garzon", "kiadó", "250 000"], r)?.price).toBe(250_000);
    expect(rowToListing(["TESZT garzon", "kiadó", "250 000"], r)?.listing_type).toBe("rent");
    expect(rowToListing(["TESZT villa", "eladó", "450 000 EUR"], r)).toMatchObject({ price: 450_000, currency: "EUR" });
  });

  it("skips rows that don't say which property they are", () => {
    expect(rowToListing(["", "lakás", "", "", "50M", "", "", "", "", ""], roles)).toBeNull();
  });
});
