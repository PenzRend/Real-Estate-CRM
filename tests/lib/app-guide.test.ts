import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appGuide } from "@/lib/assistant/app-guide";

describe("appGuide", () => {
  it("points every screen at a page that exists", () => {
    for (const g of appGuide) expect(existsSync(join("src/app/(app)", g.href, "page.tsx")), g.href).toBe(true);
  });

  it("has unique ids", () => {
    expect(new Set(appGuide.map((g) => g.id)).size).toBe(appGuide.length);
  });
});
