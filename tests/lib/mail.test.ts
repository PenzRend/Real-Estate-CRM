import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { decryptToken, encryptToken } from "@/lib/mail/crypto";
import { extractBody, htmlToText, parseAddress, parseAddressList, stripQuotedReply } from "@/lib/mail/parse";
import { classifyEmail, detectPortal, isPortalInquiry, looksLikeInquiry } from "@/lib/mail/relevance";

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

describe("token encryption", () => {
  it("round-trips and does not reveal the token", () => {
    process.env.MAIL_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
    const sealed = encryptToken("1//refresh-token-secret");
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain("refresh-token-secret");
    expect(decryptToken(sealed)).toBe("1//refresh-token-secret");
    // Same input encrypts differently each time (random IV).
    expect(encryptToken("1//refresh-token-secret")).not.toBe(sealed);
  });

  it("rejects tampered ciphertext", () => {
    process.env.MAIL_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
    const [v, iv, tag, data] = encryptToken("secret").split(".");
    const flipped = Buffer.from(data, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptToken([v, iv, tag, flipped.toString("base64url")].join("."))).toThrow();
  });
});

describe("parsing", () => {
  it("parses names, bare addresses and lists with quoted commas", () => {
    expect(parseAddress("Kovács Anna <Anna@Example.HU>")).toEqual({ name: "Kovács Anna", email: "anna@example.hu" });
    expect(parseAddress("peter@example.test")).toEqual({ name: null, email: "peter@example.test" });
    expect(parseAddress("not an address")).toBeNull();
    expect(parseAddressList('"Nagy, Béla" <bela@example.test>, eva@example.test').map((a) => a.email)).toEqual([
      "bela@example.test",
      "eva@example.test",
    ]);
  });

  it("prefers the plain-text part and falls back to HTML", () => {
    const plain = { mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64("Szia!\nÉrdekelne a lakás.") } }, { mimeType: "text/html", body: { data: b64("<p>x</p>") } }] };
    expect(extractBody(plain)).toBe("Szia!\nÉrdekelne a lakás.");
    const html = { mimeType: "text/html", body: { data: b64("<style>p{}</style><p>Érdeklődés</p><p>Tel: 06&nbsp;30</p>") } };
    expect(extractBody(html)).toBe("Érdeklődés\nTel: 06 30");
    expect(htmlToText("a&amp;b<br>c")).toBe("a&b\nc");
  });

  it("drops quoted earlier messages from replies", () => {
    expect(stripQuotedReply("Rendben, szombaton jó.\n\n2026. okt. 25., Kovács Anna írta:\n> korábbi")).toBe("Rendben, szombaton jó.");
  });
});

describe("relevance", () => {
  const clients = new Set(["peter@example.test"]);
  const own = "agent@example.test";

  it("keeps mail to and from clients in both directions", () => {
    expect(classifyEmail({ from: "peter@example.test", to: [own], subject: "Re: lakás" }, clients, own)).toMatchObject({ keep: true, reason: "client", clientEmail: "peter@example.test" });
    expect(classifyEmail({ from: own, to: ["peter@example.test"], subject: "Ajánlat" }, clients, own)).toMatchObject({ keep: true, reason: "client" });
  });

  it("keeps portal inquiries even from no-reply addresses", () => {
    expect(detectPortal("noreply@ingatlan.com")).toBe("ingatlan.com");
    expect(detectPortal("uzenet@mail.jofogas.hu")).toBe("Jófogás");
    expect(detectPortal("someone@ingatlan.com.evil.example")).toBeNull();
    expect(classifyEmail({ from: "noreply@ingatlan.com", to: [own], subject: "Új üzenet a hirdetésére" }, clients, own)).toMatchObject({ keep: true, reason: "portal", portal: "ingatlan.com" });
  });

  it("skips portal price alerts, saved searches and newsletters", () => {
    expect(isPortalInquiry("Változott az ingatlan ára")).toBe(false);
    expect(isPortalInquiry("Árfigyelő: új ár a mentett hirdetésen")).toBe(false);
    expect(isPortalInquiry("Új hirdetések a mentett keresésedhez")).toBe(false);
    expect(isPortalInquiry("Új üzenet érkezett a hirdetésére")).toBe(true);
    expect(isPortalInquiry("Érdeklődő a XI. kerületi lakásról")).toBe(true);
    expect(classifyEmail({ from: "arfigyelo@ingatlan.com", to: [own], subject: "Változott az ingatlan ára" }, clients, own)).toEqual({ keep: false });
  });

  it("keeps likely inquiries from unknown people and skips everything else", () => {
    expect(looksLikeInquiry("Érdeklődés a Budaörsi házról", "kati@example.test")).toBe(true);
    expect(looksLikeInquiry("Eladó lakás a XI. kerületben?", "x@example.test")).toBe(true);
    expect(classifyEmail({ from: "aunt@example.test", to: [own], subject: "Vasárnapi ebéd" }, clients, own)).toEqual({ keep: false });
    expect(classifyEmail({ from: "newsletter@shop.example", to: [own], subject: "Lakás dekor akció" }, clients, own)).toEqual({ keep: false });
    // Outgoing mail to strangers is never stored.
    expect(classifyEmail({ from: own, to: ["kati@example.test"], subject: "Érdeklődés" }, clients, own)).toEqual({ keep: false });
  });
});
