import { describe, expect, it } from "vitest";
import { cleanScan, isoDate, properName } from "@/lib/aml/scan-fields";

describe("ID scan clean-up", () => {
  it("writes names out of capitals", () => {
    expect(properName("TESZT BALÁZS")).toBe("Teszt Balázs");
    expect(properName("dr. KOVÁCS-NAGY ANNA")).toBe("dr. Kovács-Nagy Anna");
    expect(properName("Teszt Balázs")).toBe("Teszt Balázs");
  });

  it("reads dates in the usual Hungarian forms", () => {
    expect(isoDate("1985.03.17")).toBe("1985-03-17");
    expect(isoDate("1985. 03. 17.")).toBe("1985-03-17");
    expect(isoDate("17.03.1985")).toBe("1985-03-17");
    expect(isoDate("2031-06-30")).toBe("2031-06-30");
    expect(isoDate("1985-02-30")).toBeNull();
    expect(isoDate("")).toBeNull();
  });

  it("keeps only the form's fields, cleaned", () => {
    expect(
      cleanScan("identity", {
        full_name: "TESZT BALÁZS",
        birth_name: "TESZT BALÁZS",
        mother_name: "MINTA ÉVA",
        birth_place: "DEBRECEN",
        birth_date: "1985.03.17",
        nationality: "HUN",
        document_type: "id_card",
        document_number: "ts 000 0001",
        document_expires_on: "2031.06.30",
        personal_id: "1-850317-1234",
      }),
    ).toEqual({
      full_name: "Teszt Balázs",
      mother_name: "Minta Éva",
      birth_place: "Debrecen",
      birth_date: "1985-03-17",
      nationality: "magyar",
      document_type: "id_card",
      document_number: "TS0000001",
      document_expires_on: "2031-06-30",
    });
    expect(cleanScan("address", { address: "1133 Budapest, TESZT utca 1.", address_card_number: "123456 ab", full_name: "x" })).toEqual({
      address: "1133 Budapest, TESZT utca 1.",
      address_card_number: "123456AB",
    });
    expect(cleanScan("identity", { full_name: "", birth_date: "nem látszik" })).toEqual({});
  });
});
