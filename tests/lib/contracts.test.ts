import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { contractChecks } from "@/lib/contracts/checks";
import { CONTRACT_KINDS, kindsFor, missingFields } from "@/lib/contracts/kinds";
import { contractDocx, contractHtml, contractText, parseAmount, withWords } from "@/lib/contracts/render";

describe("contract values", () => {
  it("reads amounts and writes them in words", () => {
    expect(parseAmount("63 500 000 Ft")).toBe(63_500_000);
    expect(parseAmount("63,5 M")).toBe(63_500_000);
    expect(parseAmount("")).toBeNull();
    expect(withWords({ vetelar: "63500000" }).vetelar_szoveg).toBe("63 500 000 Ft, azaz hatvanhárommillió-ötszázezer forint");
  });

  it("marks gaps in the preview and leaves dotted lines on paper", () => {
    const body = "Eladó: {elado_nev}, hrsz: {helyrajzi_szam}, ár: {vetelar_szoveg}";
    const values = { elado_nev: "Kiss Anna", vetelar: "60000000" };
    expect(contractText("foglalasi", body, values, "final")).toBe("Eladó: Kiss Anna, hrsz: ……………………………, ár: 60 000 000 Ft, azaz hatvanmillió forint");
    expect(contractHtml("foglalasi", body, values)).toContain('<mark data-missing="true">Helyrajzi szám</mark>');
    const xml = new PizZip(contractDocx("foglalasi", "# Cím\n\n*Tervezet*", {})).file("word/document.xml")!.asText();
    expect(xml).toContain("<w:i/>");
  });

  it("knows which contracts fit a record and what is still missing", () => {
    expect(kindsFor("deal")).toEqual(["foglalasi", "adasveteli", "atadas"]);
    expect(kindsFor("deal", { rent: true })).toEqual(["berleti", "atadas"]);
    const missing = missingFields("megtekintesi", { vevo_nev: "Kiss Anna", ingatlan_cim: "Budapest" }).map((f) => f.key);
    expect(missing).toEqual(["megtekintes_datum", "iroda_nev", "ugynok_nev", "kelt_helyseg", "datum"]);
    // Every field a text uses is defined (or is an amount in words).
    for (const [kind, def] of Object.entries(CONTRACT_KINDS)) {
      const keys = new Set(def.fields.map((f) => f.key));
      for (const m of def.body.matchAll(/\{([a-z_]+)\}/g)) expect(keys.has(m[1].replace(/_szoveg$/, "")), `${kind}: ${m[1]}`).toBe(true);
    }
  });
});

describe("contractChecks", () => {
  it("flags a large deposit and dates in the wrong order", () => {
    expect(contractChecks("foglalasi", { vetelar: "60000000", foglalo: "9000000" })[0].text).toContain("15%");
    expect(contractChecks("foglalasi", { vetelar: "60000000", foglalo: "70000000" })[0].level).toBe("error");
    expect(contractChecks("foglalasi", { foglalo_hatarido: "2026. december 20.", szerzodes_datum: "2026-12-01" })).toEqual([]);
    expect(contractChecks("foglalasi", { foglalo_hatarido: "2026-12-20", szerzodes_datum: "2026-12-01" })[0].level).toBe("error");
    expect(contractChecks("foglalasi", { vetelar: "60000000", foglalo: "6000000" })).toEqual([]);
  });
});
