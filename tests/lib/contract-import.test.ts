import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { docxText, maskPersonal, tidyMoney } from "@/lib/contracts/import-text";
import { CONTRACT_KINDS, fieldsFor, missingFields } from "@/lib/contracts/kinds";
import { contractText } from "@/lib/contracts/render";

function docx(paragraphs: string) {
  const zip = new PizZip();
  zip.file("word/document.xml", `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${paragraphs}</w:body></w:document>`);
  return zip.generate({ type: "uint8array" });
}

describe("docxText", () => {
  it("keeps headings, bold, list items and line breaks", () => {
    const text = docxText(
      docx(
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Foglalási megállapodás</w:t></w:r></w:p>` +
          `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Eladó: </w:t></w:r><w:r><w:t>Kiss Anna &amp; társa</w:t></w:r></w:p>` +
          `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t>Első pont</w:t></w:r></w:p>` +
          `<w:p><w:r><w:t>Kelt:</w:t><w:br/><w:t>Budapest</w:t></w:r></w:p>`,
      ),
    );
    expect(text).toBe("# Foglalási megállapodás\n\n**Eladó:** Kiss Anna & társa\n\n- Első pont\n\nKelt:\nBudapest");
  });
  it("rejects files that are not Word documents", () => {
    expect(() => docxText(new PizZip().generate({ type: "uint8array" }))).toThrow();
  });
});

describe("maskPersonal", () => {
  it("cuts identifiers but keeps amounts and dates", () => {
    const s = maskPersonal("Szem. ig.: 123456AB, útlevél AB1234567, adóazonosító 8412345678, tel. +36 30 123 4567, e-mail kiss.anna@example.com, számla 11773016-11111111, vételár 63 500 000 Ft, 2026. május 3.");
    expect(s).toBe("Szem. ig.: [okmány], útlevél [okmány], adóazonosító [adóazonosító], tel. [telefon], e-mail [e-mail], számla [bankszámla], vételár 63 500 000 Ft, 2026. május 3.");
  });
});

describe("fieldsFor", () => {
  it("asks only for the fields the text uses, with the office's own ones labelled", () => {
    const body = "Eladó: {elado_nev}\nVételár: {vetelar_szoveg}\nHelyrajzi szám: {helyrajzi_szam}\nKözös költség: {kozos_koltseg}";
    const fields = fieldsFor("foglalasi", body, [{ key: "kozos_koltseg", label: "Közös költség" }]);
    expect(fields.map((f) => f.key).sort()).toEqual(["elado_nev", "helyrajzi_szam", "kozos_koltseg", "vetelar"]);
    expect(fields.find((f) => f.key === "kozos_koltseg")).toMatchObject({ label: "Közös költség", group: "Egyéb" });
    expect(missingFields("foglalasi", {}, body).map((f) => f.key)).not.toContain("iroda_szekhely");
    expect(contractText("foglalasi", body, {}, "preview", [{ key: "kozos_koltseg", label: "Közös költség" }])).toContain("⟦hiányzik: Közös költség⟧");
  });
  it("matches the built-in text's own fields", () => {
    const keys = fieldsFor("adasveteli", CONTRACT_KINDS.adasveteli.body).map((f) => f.key);
    expect(keys).toEqual(CONTRACT_KINDS.adasveteli.fields.map((f) => f.key));
  });
});

describe("tidyMoney", () => {
  it("drops the currency and words written around money fields", () => {
    expect(tidyMoney("vételár {vetelar_szoveg} Ft, azaz {vetelar_szoveg} forint összegben")).toBe("vételár {vetelar_szoveg} összegben");
    expect(tidyMoney("{vetelar} Ft, azaz {vetelar_szoveg} forint")).toBe("{vetelar_szoveg}");
    expect(tidyMoney("{foglalo_szoveg} Ft foglalót, havi {kozos_koltseg} Ft")).toBe("{foglalo_szoveg} foglalót, havi {kozos_koltseg} Ft");
  });
});
