import { describe, expect, it, vi } from "vitest";
import { CONTRACT_KINDS, CONTRACT_ORDER } from "@/lib/contracts/kinds";
vi.mock("server-only", () => ({}));
const { EMAIL_STARTERS } = await import("@/lib/email-auto/templates");
import { toBlocks } from "@/lib/office-docs/template-render";
import { docToText, textToDoc } from "@/lib/rich-template/convert";

const roundTrip = (t: string) => docToText(textToDoc(t));

describe("rich template conversion", () => {
  it("reads headings, bold fields, bullets, line breaks and AI paragraphs", () => {
    const doc = textToDoc("# Cím\n\nVisszaigazolom: **{megtekintes_ideje}**, {ingatlan_cim}.\n\n- egy\n- *kettő*\n\nÜdvözlettel,\n{ugynok_nev}\n\n[[AI: írj egy mondatot.]]");
    expect(doc.content.map((b) => b.type)).toEqual(["heading", "paragraph", "bulletList", "paragraph", "paragraph"]);
    expect(doc.content[1]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Visszaigazolom: " },
        { type: "field", attrs: { key: "megtekintes_ideje" }, marks: [{ type: "bold" }] },
        { type: "text", text: ", " },
        { type: "field", attrs: { key: "ingatlan_cim" } },
        { type: "text", text: "." },
      ],
    });
    expect(doc.content[3]).toEqual({ type: "paragraph", content: [{ type: "text", text: "Üdvözlettel," }, { type: "hardBreak" }, { type: "field", attrs: { key: "ugynok_nev" } }] });
    expect(doc.content[4]).toEqual({ type: "paragraph", content: [{ type: "aiBlock", attrs: { instruction: "írj egy mondatot." } }] });
  });

  it("writes marks only where they change, with spaces outside", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Eladó: ", marks: [{ type: "bold" }] },
            { type: "field", attrs: { key: "elado_nev" }, marks: [{ type: "bold" }] },
            { type: "text", text: " és " },
            { type: "text", text: "dőlt ", marks: [{ type: "italic" }] },
          ],
        },
      ],
    };
    expect(docToText(doc)).toBe("**Eladó: {elado_nev}** és *dőlt*");
  });

  it("keeps every built-in contract and email the same after a round trip through the editor", () => {
    for (const k of CONTRACT_ORDER) expect(toBlocks(roundTrip(CONTRACT_KINDS[k].body))).toEqual(toBlocks(CONTRACT_KINDS[k].body));
    for (const e of EMAIL_STARTERS) expect(toBlocks(roundTrip(e.body))).toEqual(toBlocks(e.body));
  });
});
