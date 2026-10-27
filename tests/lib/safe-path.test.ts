import { describe, expect, it } from "vitest";
import { safePath } from "@/lib/safe-path";

describe("safePath", () => {
  it("keeps this site's paths with their query", () => {
    expect(safePath("/clients", "/dashboard")).toBe("/clients");
    expect(safePath("/inbox?view=new#top", "/dashboard")).toBe("/inbox?view=new#top");
  });

  it("falls back for anything that could leave the site", () => {
    const bad = ["//evil.com", String.raw`/\evil.com`, String.raw`/\/evil.com`, "https://evil.com", "evil.com", "/ /x", "", null, 42];
    for (const value of bad) expect(safePath(value, "/dashboard")).toBe("/dashboard");
  });
});
