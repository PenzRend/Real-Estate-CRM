import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { aiInstructions, fillTemplateText, toBlocks, toDocx, toHtml } from "@/lib/office-docs/template-render";

const body = `# Bemutatkozó levél

Kedves {vevo_nev}!

[[AI: írj két mondatot arról, miért illik hozzá az ingatlan]]

## Amit kínálunk
- **Ár:** {ingatlan_ar}
- Cím: {ingatlan_cim}
Üdvözlettel, {ugynok_nev} {ismeretlen}`;

describe("template text", () => {
  it("finds AI paragraphs and fills fields and AI text", () => {
    expect(aiInstructions(body)).toEqual(["írj két mondatot arról, miért illik hozzá az ingatlan"]);
    const filled = fillTemplateText(body, { vevo_nev: "Kovács Anna", ingatlan_ar: "64 900 000 Ft", ingatlan_cim: "Budapest", ugynok_nev: "Géza" }, ["Ez a lakás pont jó."]);
    expect(filled).toContain("Kedves Kovács Anna!");
    expect(filled).toContain("Ez a lakás pont jó.");
    expect(filled).toContain("Üdvözlettel, Géza ");
    expect(fillTemplateText("[[AI: köszönj]]", {})).toBe("[AI-bekezdés: köszönj]");
  });

  it("turns text into headings, paragraphs and bullets with bold", () => {
    const blocks = toBlocks(fillTemplateText(body, { vevo_nev: "Anna" }, ["X."]));
    expect(blocks.map((b) => b.type)).toEqual(["h1", "p", "p", "h2", "li", "li", "p"]);
    // The empty price leaves only the bold label (lines are trimmed).
    expect(blocks[4].runs).toEqual([{ text: "Ár:", bold: true }]);
    expect(toBlocks("**Ár:** 5 Ft")[0].runs).toEqual([
      { text: "Ár:", bold: true },
      { text: " 5 Ft", bold: false },
    ]);
    expect(toHtml(toBlocks("- a\n- <b>"))).toBe("<ul><li>a</li><li>&lt;b&gt;</li></ul>");
    // Lines inside a paragraph keep their breaks (a signature).
    expect(toHtml(toBlocks("Üdvözlettel,\nGéza"))).toBe("<p>Üdvözlettel,<br>Géza</p>");
  });

  it("writes a Word file that holds the text", () => {
    const docx = toDocx(toBlocks("# Cím\n\nSzöveg & **félkövér**"));
    const xml = new PizZip(docx).file("word/document.xml")!.asText();
    expect(xml).toContain("Cím");
    expect(xml).toContain("Szöveg &amp; ");
    expect(xml).toContain("<w:b/>");
    expect(new PizZip(toDocx(toBlocks("Üdvözlettel,\nGéza"))).file("word/document.xml")!.asText()).toContain("<w:br/>");
  });
});
