import { describe, expect, it } from "vitest";
import { suggestFolder } from "@/lib/office-docs/suggest";

const folders = [
  { id: "t", name: "Sablonok" },
  { id: "c", name: "Szerződésminták" },
  { id: "m", name: "Marketing" },
  { id: "o", name: "Irodai ügyek" },
  { id: "k", name: "Kaposvári iroda" },
];

describe("suggestFolder", () => {
  it("puts a file where its name or meaning points", () => {
    expect(suggestFolder("Megbizasi_szerzodes_2026.docx", folders)).toBe("c");
    expect(suggestFolder("adásvételi minta.docx", folders)).toBe("c");
    expect(suggestFolder("árlista november.pdf", folders)).toBe("m");
    expect(suggestFolder("ajanlati-sablon.docx", folders)).toBe("t");
    expect(suggestFolder("kaposvari nyitvatartas.pdf", folders)).toBe("k");
  });

  it("suggests nothing when nothing fits", () => {
    expect(suggestFolder("IMG_2041.jpg", folders)).toBeNull();
    expect(suggestFolder("x.pdf", [])).toBeNull();
  });
});
