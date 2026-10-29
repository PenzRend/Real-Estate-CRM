import { describe, expect, it } from "vitest";
import { companySchema, identificationStatus, personSchema, retainUntil } from "@/lib/aml/identification";

const person = {
  full_name: "Teszt Kata",
  birth_name: "",
  mother_name: "Minta Mária",
  birth_place: "Budapest",
  birth_date: "1985-04-12",
  nationality: "magyar",
  address: "1117 Budapest, Teszt utca 1.",
  document_type: "id_card",
  document_number: "123456AB",
  document_expires_on: "2030-01-01",
  address_card_number: "",
  pep: "no",
  pep_role: "",
  source_of_funds: "megtakarítás",
  purpose: "Ingatlan adásvétel közvetítése",
  notes: "",
};

describe("AML identification", () => {
  it("asks for what the Pmt. lists, in Hungarian", () => {
    expect(personSchema.safeParse(person).success).toBe(true);
    const missing = personSchema.safeParse({ ...person, mother_name: "", document_number: "" });
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.map((i) => i.message)).toEqual(["Add meg az anyja születési nevét.", "Add meg az okmány számát."]);
    expect(companySchema.safeParse({ company_name: "Teszt Kft.", registration_number: "01-09-123456", tax_number: "", seat: "Budapest", representative_name: "Teszt Péter", representative_document: "", beneficial_owners: "", pep: "no", pep_role: "", source_of_funds: "", purpose: "Bérbeadás" }).success).toBe(false);
  });

  it("tells whether the identification is in order", () => {
    const s = { kind: "person" as const, pep: false, documentExpiresOn: "2030-01-01", verifiedOn: "2026-10-29" };
    expect(identificationStatus(null, "2026-10-29").state).toBe("missing");
    expect(identificationStatus(s, "2026-10-29")).toEqual({ state: "ok", label: "Azonosítva" });
    expect(identificationStatus({ ...s, pep: true }, "2026-10-29").label).toBe("Azonosítva · kiemelt közszereplő");
    expect(identificationStatus({ ...s, documentExpiresOn: "2026-11-15" }, "2026-10-29").state).toBe("expiring");
    expect(identificationStatus({ ...s, documentExpiresOn: "2026-10-01" }, "2026-10-29").state).toBe("expired");
  });

  it("keeps the data for 8 years from the identification or the last deal, whichever is later", () => {
    expect(retainUntil("2026-10-29", null)).toBe("2034-10-29");
    expect(retainUntil("2026-10-29", "2027-03-01")).toBe("2035-03-01");
    expect(retainUntil("2026-10-29", "2025-01-01")).toBe("2034-10-29");
  });
});
