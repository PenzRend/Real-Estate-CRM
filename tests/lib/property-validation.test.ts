import { describe, expect, it } from "vitest";
import { parsePropertyForm } from "@/lib/validation/property";

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const base = { title: "Napfényes lakás", property_type: "apartment", status: "active", listing_type: "sale", currency: "HUF" };

describe("parsePropertyForm", () => {
  it("parses a listing as an agent types it", () => {
    const r = parsePropertyForm(
      form({
        ...base,
        price: "79,9 M",
        area_sqm: "64,5",
        room_count: "2,5",
        bedroom_count: "2",
        postal_code: "1117",
        has_balcony: "true",
        has_garden: "false",
        city: " Budapest ",
        owner_client_id: "",
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toMatchObject({
        price: 79_900_000,
        area_sqm: 64.5,
        room_count: 2.5,
        bedroom_count: 2,
        postal_code: "1117",
        has_balcony: true,
        has_garden: false,
        // Not stated stays unknown, so matching doesn't read it as "no parking".
        has_parking: null,
        source_url: null,
        city: "Budapest",
        owner_client_id: null,
        reference_number: null,
      });
    }
  });

  it("reports Hungarian field errors", () => {
    const r = parsePropertyForm(
      form({ ...base, title: "", postal_code: "11170", bedroom_count: "1,5", status: "gone", owner_client_id: "abc" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.title).toBe("Adj meg egy megnevezést.");
      expect(r.errors.postal_code).toBe("A magyar irányítószám 4 számjegy.");
      expect(r.errors.bedroom_count).toBe("Egész számot adj meg.");
      expect(r.errors.status).toBe("Válassz státuszt.");
      expect(r.errors.owner_client_id).toBe("Válassz a listából.");
    }
  });
});
