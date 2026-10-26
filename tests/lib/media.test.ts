import { describe, expect, it } from "vitest";
import { acceptMedia, formatBytes, isMediaPathFor, mediaPath, scaledSize, VIDEO_MAX_MB } from "@/lib/media/rules";

const MB = 1024 * 1024;
const ORG = "11111111-1111-4111-8111-111111111111";
const PROP = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";

describe("accepted files", () => {
  it("takes common photo and video formats within the limits", () => {
    expect(acceptMedia({ name: "nappali.jpg", type: "image/jpeg", size: 8 * MB })).toEqual({ ok: true, kind: "photo" });
    expect(acceptMedia({ name: "alaprajz.png", type: "image/png", size: MB })).toEqual({ ok: true, kind: "photo" });
    expect(acceptMedia({ name: "seta.mp4", type: "video/mp4", size: 30 * MB })).toEqual({ ok: true, kind: "video" });
    expect(acceptMedia({ name: "seta.mov", type: "video/quicktime", size: 30 * MB })).toEqual({ ok: true, kind: "video" });
  });

  it("explains what is wrong, in Hungarian", () => {
    const big = acceptMedia({ name: "seta.mp4", type: "video/mp4", size: (VIDEO_MAX_MB + 10) * MB });
    expect(big.ok === false && big.error).toContain(`legfeljebb ${VIDEO_MAX_MB} MB`);
    const heic = acceptMedia({ name: "IMG_0001.HEIC", type: "", size: MB });
    expect(heic.ok === false && heic.error).toContain("HEIC");
    const pdf = acceptMedia({ name: "tulajdoni.pdf", type: "application/pdf", size: MB });
    expect(pdf.ok === false && pdf.error).toContain("csak JPG");
  });
});

describe("sizes", () => {
  it("fits inside the limit without enlarging", () => {
    expect(scaledSize(4032, 3024, 2560)).toEqual({ width: 2560, height: 1920 });
    expect(scaledSize(3024, 4032, 640)).toEqual({ width: 480, height: 640 });
    expect(scaledSize(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });

  it("formats file sizes", () => {
    expect(formatBytes(2.5 * MB)).toBe("2,5 MB");
    expect(formatBytes(300 * 1024)).toBe("300 kB");
  });
});

describe("storage paths", () => {
  it("puts files in the workspace and property folder", () => {
    expect(mediaPath(ORG, PROP, FILE, "image/jpeg")).toBe(`${ORG}/${PROP}/${FILE}.jpg`);
    expect(mediaPath(ORG, PROP, FILE, "video/quicktime", true)).toBe(`${ORG}/${PROP}/${FILE}-thumb.jpg`);
  });

  it("accepts only paths the app made, for this property", () => {
    expect(isMediaPathFor(mediaPath(ORG, PROP, FILE, "video/mp4"), ORG, PROP)).toBe(true);
    expect(isMediaPathFor(mediaPath(ORG, PROP, FILE, "image/jpeg", true), ORG, PROP, true)).toBe(true);
    expect(isMediaPathFor(`${ORG}/${PROP}/../other.jpg`, ORG, PROP)).toBe(false);
    expect(isMediaPathFor(`${ORG}/${FILE}/${FILE}.jpg`, ORG, PROP)).toBe(false);
    expect(isMediaPathFor(`${ORG}/${PROP}/${FILE}.exe`, ORG, PROP)).toBe(false);
  });
});
