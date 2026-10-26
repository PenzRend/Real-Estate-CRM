import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { fetchableUrl } from "@/lib/listings/fetch-page";
import { isBotCheckPage, largestFromSrcset, pageImages, pageText, pageVideoLinks, robotsDisallows, structuredData } from "@/lib/listings/html";
import { blocksServers } from "@/lib/listings/source";

const PAGE = `<!doctype html><html><head><title>Eladó lakás</title>
<meta property="og:image" content="https://cdn.otthonterkep.hu/kepek/1-nagy.jpg">
<script type="application/ld+json">{"@type":"Residence","name":"Lakás","image":["https://cdn.otthonterkep.hu/kepek/2.jpg",{"url":"https://cdn.otthonterkep.hu/kepek/3.jpg"}]}</script>
<style>.x{color:red}</style></head><body><header><img src="/logo.png" width="120"></header>
<main><h1>Eladó tégla lakás &amp; erkély</h1><p>74,9&nbsp;M Ft</p><div>68 m²</div>
<img srcset="/kepek/4-kicsi.jpg 640w, /kepek/4-nagy.jpg 1600w" alt="">
<img data-src="https://cdn.otthonterkep.hu/kepek/5.webp">
<img src="/ui/icon-heart.png">
<iframe src="https://www.youtube.com/embed/abc123"></iframe>
<a href="https://my.matterport.com/show/?m=xyz">Virtuális séta</a>
<a href="https://example.com/video">nem videó</a>
<script>window.tracking = 1</script></main></body></html>`;

describe("reading a listing page on the server", () => {
  it("keeps the main content's text, without markup or scripts", () => {
    const text = pageText(PAGE);
    expect(text).toContain("Eladó tégla lakás & erkély");
    expect(text).toContain("74,9 M Ft");
    expect(text).not.toMatch(/tracking|color:red|<\/?\w/);
  });

  it("finds the listing's photos, largest versions, without UI images", () => {
    expect(pageImages(PAGE, "https://www.otthonterkep.hu/hirdetes/123")).toEqual([
      "https://cdn.otthonterkep.hu/kepek/2.jpg",
      "https://cdn.otthonterkep.hu/kepek/3.jpg",
      "https://cdn.otthonterkep.hu/kepek/1-nagy.jpg",
      "https://www.otthonterkep.hu/kepek/4-nagy.jpg",
      "https://cdn.otthonterkep.hu/kepek/5.webp",
    ]);
    expect(largestFromSrcset("a.jpg 1x, b.jpg 2x")).toBe("b.jpg");
    expect(structuredData(PAGE)).toContain("Residence");
  });

  it("unwraps image-resizer addresses to the original photo", () => {
    const html = `<main><img alt="1. képe" width="0" srcSet="/_next/image?url=https%3A%2F%2Fpic01.example.test%2Fingatlan%2F1.jpg&amp;w=640&amp;q=75 640w, /_next/image?url=https%3A%2F%2Fpic01.example.test%2Fingatlan%2F1.jpg&amp;w=3840&amp;q=75 3840w"><img alt="logo" width="38" src="https://pic01.example.test/fhk/9.jpg"><meta content="https://pic01.example.test/ingatlan/0.jpg" property="og:image"></main>`;
    expect(pageImages(html, "https://www.ingatlannet.hu/x/1")).toEqual(["https://pic01.example.test/ingatlan/0.jpg", "https://pic01.example.test/ingatlan/1.jpg"]);
  });

  it("keeps video and virtual-tour links only", () => {
    expect(pageVideoLinks(PAGE, "https://www.otthonterkep.hu/")).toEqual(["https://www.youtube.com/embed/abc123", "https://my.matterport.com/show/?m=xyz"]);
  });

  it("recognises a bot check instead of the listing", () => {
    const h = (v: Record<string, string>) => ({ get: (k: string) => v[k] ?? null });
    expect(isBotCheckPage(403, "<title>Csak egy gyors ellenőrzés - ingatlan.com</title>", h({ "cf-mitigated": "challenge" }))).toBe(true);
    expect(isBotCheckPage(200, "<title>Just a moment...</title>", h({}))).toBe(true);
    expect(isBotCheckPage(429, "", h({}))).toBe(true);
    expect(isBotCheckPage(200, PAGE, h({}))).toBe(false);
  });
});

describe("what the server may open", () => {
  it("only https pages of known portals", () => {
    expect(fetchableUrl("https://www.otthonterkep.hu/hirdetes/123")).not.toBeNull();
    expect(fetchableUrl("https://cdn.otthonterkep.hu/kepek/1.jpg")).not.toBeNull();
    for (const bad of ["http://otthonterkep.hu/x", "https://otthonterkep.hu:8443/x", "https://user@otthonterkep.hu/x", "https://169.254.169.254/latest", "https://example.com/x", "https://otthonterkep.hu.evil.test/x"]) {
      expect(fetchableUrl(bad)).toBeNull();
    }
  });

  it("knows which portals turn servers away", () => {
    expect(blocksServers("https://ingatlan.com/34567890")).toBe(true);
    expect(blocksServers("https://www.otthonterkep.hu/x")).toBe(false);
  });

  it("respects robots.txt for everyone ('*')", () => {
    const robots = "User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /lista\nDisallow: */nyomtatas\nAllow: /lista/nyitott$\n";
    expect(robotsDisallows(robots, "/lista/elado")).toBe(true);
    expect(robotsDisallows(robots, "/34567890/nyomtatas")).toBe(true);
    expect(robotsDisallows(robots, "/lista/nyitott")).toBe(false);
    expect(robotsDisallows(robots, "/34567890")).toBe(false);
    expect(robotsDisallows("", "/x")).toBe(false);
  });
});
