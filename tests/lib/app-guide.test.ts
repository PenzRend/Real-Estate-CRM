import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appGuide } from "@/lib/assistant/app-guide";

/** The folders a URL path can live in: route groups like "(list)" or "(teendok)" may sit at any level. */
function dirsFor(dir: string, segments: string[]): string[] {
  if (!existsSync(dir)) return [];
  const groups = readdirSync(dir).filter((d) => /^\(.+\)$/.test(d)).flatMap((g) => dirsFor(join(dir, g), segments));
  if (!segments.length) return [dir, ...groups];
  return [...dirsFor(join(dir, segments[0]), segments.slice(1)), ...groups];
}

function pageExists(href: string) {
  return dirsFor("src/app/(app)", href.split("?")[0].split("/").filter(Boolean)).some((d) => existsSync(join(d, "page.tsx")));
}

describe("appGuide", () => {
  it("points every screen at a page that exists", () => {
    for (const g of appGuide) expect(pageExists(g.href), g.href).toBe(true);
  });

  it("has unique ids", () => {
    expect(new Set(appGuide.map((g) => g.id)).size).toBe(appGuide.length);
  });
});
