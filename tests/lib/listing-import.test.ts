import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { extractionToFormValues, missingKeyFields, sliceDescription, type ListingExtraction } from "@/lib/listings/extract-schema";
import { compactText } from "@/lib/listings/import";
import { decodePayload, encodePayload } from "@/lib/listings/payload";
import { canonicalListingUrl, looksLikeListingText, portalOf } from "@/lib/listings/source";
import { parsePropertyForm } from "@/lib/validation/property";

describe("listing addresses", () => {
  it("recognises the same ingatlan.com listing however it was linked", () => {
    for (const u of [
      "https://ingatlan.com/34567890",
      "https://www.ingatlan.com/34567890?utm_source=email#gallery",
      "http://ingatlan.com/szukites/34567890/",
    ]) {
      expect(canonicalListingUrl(u)).toBe("https://ingatlan.com/34567890");
    }
  });

  it("rejects non-listing and non-web addresses", () => {
    expect(canonicalListingUrl("https://ingatlan.com/lista/elado+lakas")).toBeNull();
    expect(canonicalListingUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalListingUrl("nem link")).toBeNull();
    // Other portals keep their path, without query and hash.
    expect(canonicalListingUrl("https://www.jofogas.hu/budapest/lakas_123.htm?x=1")).toBe("https://jofogas.hu/budapest/lakas_123.htm");
    expect(portalOf(new URL("https://www.ingatlan.com/1"))?.name).toBe("ingatlan.com");
  });

  it("asks for the page text, not just a link", () => {
    expect(looksLikeListingText("https://ingatlan.com/34567890")).toBe(false);
    expect(looksLikeListingText("Eladó tégla lakás, Budapest XI. kerület, 64 m², 2 + 1 fél szoba, 79,9 M Ft. Erkélyes, felújított.")).toBe(true);
  });
});

describe("extension payload", () => {
  it("survives the round trip, Hungarian text included", () => {
    const p = {
      kind: "listing" as const,
      url: "https://ingatlan.com/34567890",
      text: "Eladó lakás – Őrs vezér tere, 79,9 M Ft",
      structured: null,
      images: ["https://img.example.test/1.jpg"],
      videos: ["https://www.youtube.com/watch?v=abc"],
    };
    expect(decodePayload(`#${encodePayload(p)}`)).toEqual(p);
    // Older payloads without photos still work.
    expect(decodePayload(`#${encodePayload({ kind: "listing", url: p.url, text: p.text })}`)).toMatchObject({ images: [], videos: [] });
  });

  it("ignores anything malformed", () => {
    expect(decodePayload("#import=@@@")).toBeNull();
    expect(decodePayload("#other=abc")).toBeNull();
    expect(decodePayload(`#${encodePayload({ kind: "listing", url: "", text: "x" })}`)).toBeNull();
  });

  it("keeps only usable profile entries", () => {
    const p = decodePayload(
      `#${encodePayload({ kind: "profile", source: "https://ingatlan.com/iroda/x", listings: [{ url: "https://ingatlan.com/1234567", title: "Lakás", detail: null }, { url: "", title: "x", detail: null }] })}`,
    );
    expect(p?.kind === "profile" && p.listings).toEqual([{ url: "https://ingatlan.com/1234567", title: "Lakás", detail: null }]);
  });
});

describe("extraction to the review form", () => {
  const e: ListingExtraction = {
    title: "Felújított 2,5 szobás lakás erkéllyel",
    listing_type: "sale",
    property_type: "apartment",
    price: 79_900_000,
    currency: "HUF",
    city: "Budapest",
    district: "XI. kerület",
    address: null,
    postal_code: "1117",
    area_sqm: 64.5,
    room_count: 2.5,
    bedroom_count: 3,
    bathroom_count: 1,
    floor: "3. emelet",
    building_type: "tégla",
    condition: "felújított",
    energy_rating: null,
    has_balcony: true,
    has_garden: null,
    has_parking: false,
    elevator: true,
    air_conditioning: true,
    furnished: null,
    heating: "gáz (cirko)",
    orientation: null,
    view: "utcai",
    year_built: 1905,
    common_cost_huf: 52000,
    description_start: "Világos, csendes lakás a",
    description_end: "metró 3 percre.",
    reference_number: null,
  };

  it("fills the property form, unknowns stay empty, and it validates", () => {
    const page = "Menü Keresés\nLeírás\nVilágos, csendes lakás a  XI. kerületben,\nfelújított fürdővel. A metró 3 percre.\nHasonló hirdetések";
    const values = extractionToFormValues(e, { url: "https://ingatlan.com/34567890", portalName: "ingatlan.com" }, page);
    expect(values).toMatchObject({ status: "draft", price: "79900000", area_sqm: "64,5", room_count: "2,5", has_balcony: "true", has_garden: "", has_parking: "false", listing_source: "ingatlan.com" });
    // Copied from the page exactly, line breaks included; menus and other listings left out.
    expect(values.description).toBe("Világos, csendes lakás a  XI. kerületben,\nfelújított fürdővel. A metró 3 percre.");
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.append(k, v);
    const parsed = parsePropertyForm(fd);
    expect(parsed.ok && parsed.data).toMatchObject({ price: 79_900_000, area_sqm: 64.5, bedroom_count: 3, has_balcony: true, has_garden: null, has_parking: false, source_url: "https://ingatlan.com/34567890" });
    // Lift, klíma, fűtés… land in the "Felszereltség és egyéb" fields; unknowns stay out.
    expect(parsed.ok && parsed.extras).toEqual({ elevator: true, air_conditioning: true, heating: "gáz (cirko)", view: "utcai", year_built: 1905, common_cost_huf: 52000 });
  });

  it("copies the description only when the marked words are on the page", () => {
    const page = "Leírás: Tágas (felújított) lakás [3. emelet] csendes utcában, azonnal költözhető.";
    expect(sliceDescription(page, "Tágas (felújított) lakás", "azonnal költözhető.")).toBe("Tágas (felújított) lakás [3. emelet] csendes utcában, azonnal költözhető.");
    // Words the AI made up, or in the wrong order, give no description rather than a wrong one.
    expect(sliceDescription(page, "Gyönyörű panoráma", "költözhető.")).toBeNull();
    expect(sliceDescription(page, "azonnal költözhető.", "Tágas")).toBeNull();
    expect(sliceDescription(page, null, null)).toBeNull();
  });

  it("compacts page text for the AI without breaking label/value pairs", () => {
    expect(compactText("Menü\n\n\n  Eladó lakás, 64 m²  \nKapcsolat")).toBe("Menü\nEladó lakás, 64 m²\nKapcsolat");
    // Repeated values stay next to their labels.
    expect(compactText("Erkély mérete\nnincs megadva\n\nKertkapcsolatos\nnincs megadva\nParkolás\nnincs megadva")).toBe(
      "Erkély mérete\nnincs megadva\nKertkapcsolatos\nnincs megadva\nParkolás\nnincs megadva",
    );
  });

  it("names the key facts the page didn't state", () => {
    expect(missingKeyFields({ ...e, floor: null, has_parking: null })).toEqual(["emelet", "parkolás"]);
  });
});
