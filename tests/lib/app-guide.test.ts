import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appGuide } from "@/lib/assistant/app-guide";

/** A page for the path, directly or inside a route group like "(list)". */
function pageExists(href: string) {
  const dir = join("src/app/(app)", href);
  if (existsSync(join(dir, "page.tsx"))) return true;
  return existsSync(dir) && readdirSync(dir).some((d) => /^\(.+\)$/.test(d) && existsSync(join(dir, d, "page.tsx")));
}

describe("appGuide", () => {
  it("points every screen at a page that exists", () => {
    for (const g of appGuide) expect(pageExists(g.href), g.href).toBe(true);
  });

  it("has unique ids", () => {
    expect(new Set(appGuide.map((g) => g.id)).size).toBe(appGuide.length);
  });
});
