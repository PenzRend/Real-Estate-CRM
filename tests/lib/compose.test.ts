import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildReplyMime, encodeHeader, findPlaceholders, parseRecipients, toBase64Url } from "@/lib/mail/compose";
import { safeNext } from "@/lib/mail/google";

describe("before sending", () => {
  it("finds the gaps the AI left, once each", () => {
    expect(findPlaceholders("Kedden [időpont]-kor, ára [ár] Ft. Újra: [időpont]")).toEqual(["[időpont]", "[ár]"]);
    expect(findPlaceholders("Minden kitöltve.")).toEqual([]);
  });

  it("accepts only valid recipient lists", () => {
    expect(parseRecipients("Eva@Example.test")).toEqual(["eva@example.test"]);
    expect(parseRecipients("a@example.test; b@example.test, a@example.test")).toEqual(["a@example.test", "b@example.test"]);
    expect(parseRecipients("")).toBeNull();
    expect(parseRecipients("nem cím")).toBeNull();
    expect(parseRecipients("a@example.test\r\nBcc: x@evil.test")).toBeNull();
  });
});

describe("MIME reply", () => {
  const decode = (mime: string) => {
    const [head, body] = mime.split("\r\n\r\n");
    return { head, body: Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8") };
  };

  it("encodes Hungarian text and keeps the body intact", () => {
    const { head, body } = decode(
      buildReplyMime({ from: "agent@example.test", to: ["eva@example.test"], subject: "Re: Érdeklődés", body: "Kedves Éva!\n\nÜdvözlettel" }),
    );
    expect(head).toContain(`Subject: ${encodeHeader("Re: Érdeklődés")}`);
    expect(head).toContain("Content-Type: text/plain; charset=UTF-8");
    expect(head).not.toContain("In-Reply-To");
    expect(body).toBe("Kedves Éva!\r\n\r\nÜdvözlettel");
  });

  it("threads the reply under the original message", () => {
    const { head } = decode(
      buildReplyMime({ from: "a@example.test", to: ["b@example.test"], subject: "Re: x", body: "y", inReplyTo: "<m2@mail.test>", references: "<m1@mail.test>" }),
    );
    expect(head).toContain("In-Reply-To: <m2@mail.test>");
    expect(head).toContain("References: <m1@mail.test> <m2@mail.test>");
  });

  it("cannot be used to inject headers", () => {
    expect(encodeHeader("Szia\r\nBcc: x@evil.test")).not.toMatch(/[\r\n]/);
    const { head } = decode(buildReplyMime({ from: "a@example.test", to: ["b@example.test"], subject: "x", body: "y", inReplyTo: "<a>\r\nBcc: x@evil.test" }));
    expect(head).not.toContain("Bcc");
  });

  it("is base64url for the Gmail API", () => {
    expect(toBase64Url("ő?>")).not.toMatch(/[+/=]/);
  });
});

describe("OAuth return path", () => {
  it("only allows paths inside the app", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("//evil.test")).toBe("/inbox");
    expect(safeNext("https://evil.test")).toBe("/inbox");
    expect(safeNext(null)).toBe("/inbox");
  });
});
