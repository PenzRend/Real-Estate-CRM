import { describe, expect, it } from "vitest";
import { cleanOrigin, extensionZip, tailor } from "@/lib/extension/package";
import { crc32, zip } from "@/lib/extension/zip";

const enc = new TextEncoder();

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
  });

  it("writes stored entries with a central directory", () => {
    const out = zip([
      { name: "a/x.txt", data: enc.encode("hello") },
      { name: "a/é.txt", data: enc.encode("világ") },
    ]);
    const v = new DataView(out.buffer);
    expect(v.getUint32(0, true)).toBe(0x04034b50);
    const end = out.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    const centralStart = v.getUint32(end + 16, true);
    expect(v.getUint32(centralStart, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(out)).toContain("hello");
  });
});

describe("extension package", () => {
  const files = {
    "manifest.json": enc.encode(JSON.stringify({
      content_scripts: [
        { matches: ["https://ingatlan.com/*"], js: ["collect.js"] },
        { matches: ["http://localhost:3000/*"], js: ["bridge.js"] },
      ],
    })),
    "popup.js": enc.encode('const DEFAULT_CRM = "http://localhost:3000";'),
    "icons/icon16.png": new Uint8Array([137, 80, 78, 71, 0, 255]),
  };
  const dec = new TextDecoder();

  it("points the bridge script and the default CRM address at the downloading CRM", () => {
    const out = tailor(files, "https://crm.example.hu");
    const manifest = JSON.parse(dec.decode(out["manifest.json"]));
    expect(manifest.content_scripts[0].matches).toEqual(["https://ingatlan.com/*"]);
    expect(manifest.content_scripts[1].matches).toEqual(["https://crm.example.hu/*"]);
    expect(dec.decode(out["popup.js"])).toBe('const DEFAULT_CRM = "https://crm.example.hu";');
  });

  it("keeps the development address when downloaded from it", () => {
    const out = tailor(files, "http://localhost:3000");
    expect(JSON.parse(dec.decode(out["manifest.json"])).content_scripts[1].matches).toEqual(["http://localhost:3000/*"]);
  });

  it("accepts only http(s) origins", () => {
    expect(cleanOrigin("https://crm.example.hu/")).toBe("https://crm.example.hu");
    expect(cleanOrigin("javascript:alert(1)")).toBeNull();
    expect(cleanOrigin("nonsense")).toBeNull();
  });

  it("puts every file in one folder", () => {
    const text = new TextDecoder().decode(extensionZip(files, "https://crm.example.hu"));
    expect(text).toContain("ingatlan-crm-bovitmeny/manifest.json");
    expect(text).toContain("ingatlan-crm-bovitmeny/popup.js");
  });

  it("passes binary files through untouched", () => {
    expect(tailor(files, "https://crm.example.hu")["icons/icon16.png"]).toEqual(files["icons/icon16.png"]);
  });

  it("puts files at the root for a store upload", () => {
    const text = new TextDecoder().decode(extensionZip(files, "https://crm.example.hu", { folder: null }));
    expect(text).not.toContain("ingatlan-crm-bovitmeny/");
    expect(text).toContain("manifest.json");
  });
});
