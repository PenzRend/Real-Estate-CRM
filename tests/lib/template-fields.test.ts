import { describe, expect, it } from "vitest";
import { FIELD_HELP, templateValues } from "@/lib/office-docs/fields";

const base = {
  buyer: { full_name: "Kovács Anna", phone: "+36 30 123 4567", email: "anna@example.test" },
  seller: { full_name: "Szabó Péter", phone: null, email: null },
  property: { title: "Napfényes lakás", address: "Bartók Béla út 12.", city: "Budapest", district: "XI. kerület", postal_code: "1114", price: 64_900_000, area_sqm: 64.5, room_count: 2.5, reference_number: "F-12" },
  deal: { agreed_price: 63_000_000, deposit_amount: 6_300_000, deposit_due: "2026-11-20", contract_on: null, handover_on: "2027-01-15", commission: 1_890_000 },
  agent: { name: "Orosz Géza", email: "geza@example.test" },
  office: "Flavio Iroda",
  today: "2026-11-07",
};

describe("templateValues", () => {
  it("fills every documented field, in Hungarian formats", () => {
    const v = templateValues(base);
    expect(Object.keys(v).sort()).toEqual(FIELD_HELP.map((f) => f.key).sort());
    expect(v.ingatlan_cim).toBe("1114 Budapest, XI. kerület, Bartók Béla út 12.");
    expect(v.vetelar).toBe("63 000 000 Ft");
    expect(v.alapterulet).toBe("64,5");
    expect(v.foglalo_hatarido).toBe("2026. november 20.");
    expect(v.szerzodes_datum).toBe("");
    expect(v.datum).toBe("2026. november 7.");
  });

  it("leaves missing records empty instead of failing", () => {
    const v = templateValues({ ...base, buyer: null, seller: null, property: null, deal: null });
    expect(v.vevo_nev).toBe("");
    expect(v.ingatlan_cim).toBe("");
    expect(v.jutalek).toBe("");
    expect(v.ugynok_nev).toBe("Orosz Géza");
  });
});
