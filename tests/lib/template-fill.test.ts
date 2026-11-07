import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { templateValues } from "@/lib/office-docs/fields";

// A minimal Word document with placeholders, filled the way fill.ts does it.
function docx(text: string) {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generate({ type: "nodebuffer" });
}

describe("filling a Word template", () => {
  it("puts the values in and leaves unknown fields empty", () => {
    const values = templateValues({
      buyer: { full_name: "Kovács Anna", phone: null, email: null },
      seller: null,
      property: null,
      deal: { agreed_price: 63_000_000, deposit_amount: null, deposit_due: null, contract_on: null, handover_on: null, commission: null },
      agent: { name: "Orosz Géza", email: "geza@example.test" },
      office: "Flavio Iroda",
      today: "2026-11-07",
    });
    const doc = new Docxtemplater(new PizZip(docx("Vevő: {vevo_nev}, ár: {vetelar}, ismeretlen: [{nincs_ilyen}]")), { paragraphLoop: true, linebreaks: true, nullGetter: () => "" });
    doc.render(values);
    const xml = doc.getZip().file("word/document.xml")!.asText();
    expect(xml).toContain("Vevő: Kovács Anna, ár: 63 000 000 Ft, ismeretlen: []");
  });
});
