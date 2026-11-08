import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { guessRoles, parseBudget, parseMoney, parseType, rowToClient } from "@/lib/import/clients";
import { readCsv, readVcf, readXlsx } from "@/lib/import/table";

describe("readCsv", () => {
  it("reads Hungarian Excel CSVs with semicolons, quotes and line breaks", () => {
    const t = readCsv('﻿Név;Telefon;Megjegyzés\r\nKiss Anna;+36 30 123 4567;"Erkély kell; 2 szoba"\r\n"Nagy ""Peti"" Péter";06201234567;"első sor\nmásodik"\r\n\r\n');
    expect(t.header).toEqual(["Név", "Telefon", "Megjegyzés"]);
    expect(t.rows).toEqual([
      ["Kiss Anna", "+36 30 123 4567", "Erkély kell; 2 szoba"],
      ['Nagy "Peti" Péter', "06201234567", "első sor második"],
    ]);
  });
});

describe("readXlsx", () => {
  it("reads the first sheet with shared and inline strings and gaps", () => {
    const zip = new PizZip();
    zip.file("xl/workbook.xml", '<workbook><sheets><sheet name="Ügyfelek" sheetId="1" r:id="rId1"/></sheets></workbook>');
    zip.file("xl/_rels/workbook.xml.rels", '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>');
    zip.file("xl/sharedStrings.xml", "<sst><si><t>Név</t></si><si><t>Keret</t></si><si><r><t>Kiss </t></r><r><t>Anna</t></r></si></sst>");
    zip.file(
      "xl/worksheets/sheet1.xml",
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>55000000</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Nagy &amp; Fiai</t></is></c></row></sheetData></worksheet>',
    );
    const t = readXlsx(zip.generate({ type: "uint8array" }));
    expect(t.header).toEqual(["Név", "", "Keret"]);
    expect(t.rows).toEqual([
      ["Kiss Anna", "", "55000000"],
      ["Nagy & Fiai", "", ""],
    ]);
  });
});

describe("readVcf", () => {
  it("reads iPhone and Android contact cards", () => {
    const t = readVcf("BEGIN:VCARD\r\nVERSION:3.0\r\nN:Kiss;Anna;;;\r\nFN:Kiss Anna\r\nTEL;type=CELL:+36 30 123 4567\r\nEMAIL:anna@example.com\r\nNOTE:Budai lakást\\, max 60M\r\nEND:VCARD\r\nBEGIN:VCARD\r\nN:Nagy;Péter\r\nTEL:06 20 765 4321\r\nEND:VCARD\r\n");
    expect(t.rows).toEqual([
      ["Kiss Anna", "+36 30 123 4567", "anna@example.com", "", "Budai lakást, max 60M"],
      ["Nagy Péter", "06 20 765 4321", "", "", ""],
    ]);
  });
});

describe("guessRoles", () => {
  it("knows Hungarian and English headers, and phones and emails by their values", () => {
    expect(guessRoles(["Vezetéknév", "Keresztnév", "Mobil", "E-mail cím", "Ügyféltípus", "Keret", "Kerület", "Megjegyzés"])).toEqual([
      "last_name",
      "first_name",
      "phone",
      "email",
      "type",
      "budget",
      "locations",
      "notes",
    ]);
    expect(guessRoles(["Name", "Max ár", "Min ár"])).toEqual(["name", "budget_max", "budget_min"]);
    expect(guessRoles(["Név", "A", "B"], [["Kiss Anna", "anna@x.hu", "+36 30 123 4567"]])).toEqual(["name", "email", "phone"]);
  });
});

describe("money and types", () => {
  it("reads amounts and ranges the way agents write them", () => {
    expect(parseMoney("50M")).toBe(50_000_000);
    expect(parseMoney("49,9 millió Ft")).toBe(49_900_000);
    expect(parseMoney("55 000 000")).toBe(55_000_000);
    expect(parseMoney("55.000.000 Ft")).toBe(55_000_000);
    expect(parseMoney("60")).toBe(60_000_000);
    expect(parseMoney("800e")).toBe(800_000);
    expect(parseMoney("sok")).toBeNull();
    expect(parseBudget("40-60M")).toEqual([40_000_000, 60_000_000]);
    expect(parseBudget("40–60 millió")).toEqual([40_000_000, 60_000_000]);
    expect(parseBudget("max 60M")).toEqual([null, 60_000_000]);
    expect(parseBudget("70M-ig")).toEqual([null, 70_000_000]);
    expect(parseType("Eladó")).toBe("seller");
    expect(parseType("bérlő")).toBe("tenant");
    expect(parseType("")).toBe("buyer");
  });

  it("turns a row into a client, family name first, and drops rows nobody can be found by", () => {
    const roles = guessRoles(["Vezetéknév", "Keresztnév", "Telefon", "Keret", "Kerület", "Megjegyzés"]);
    expect(rowToClient(["Kiss", "Anna", "+36 30 123 4567, 06 1 234 5678", "40-60M", "XI. kerület, Budaörs", "2 szoba"], roles)).toEqual({
      full_name: "Kiss Anna",
      phone: "+36 30 123 4567",
      email: null,
      client_type: "buyer",
      budget_min: 40_000_000,
      budget_max: 60_000_000,
      preferred_locations: ["XI. kerület", "Budaörs"],
      notes: "2 szoba",
      lead_source: null,
    });
    expect(rowToClient(["", "", "", "50M", "", "valami"], roles)).toBeNull();
  });
});
