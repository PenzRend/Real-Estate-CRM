import { describe, expect, it } from "vitest";
import { awayHeadline, awaySince, findMentionedProperty, gmailComposeUrl, nextVisit, replyRecipient, replySubject } from "@/lib/away/logic";

const now = new Date("2026-10-26T18:00:00Z");
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("away window", () => {
  it("starts 24 hours back on the first visit, and doesn't drift on reload", () => {
    expect(awaySince(null, now).toISOString()).toBe(minsAgo(24 * 60));
    const reload = new Date(now.getTime() + 2 * 60_000);
    expect(awaySince(nextVisit(null, now), reload).toISOString()).toBe(minsAgo(24 * 60));
  });

  it("starts at the last visit after a long gap, and stays put within the session", () => {
    const visit = { lastSeenAt: minsAgo(600), previousSeenAt: minsAgo(2000) };
    expect(awaySince(visit, now).toISOString()).toBe(minsAgo(600));
    // The visit is recorded; ten minutes later the window has not moved.
    const stored = nextVisit(visit, now);
    const later = new Date(now.getTime() + 10 * 60_000);
    expect(awaySince(stored, later).toISOString()).toBe(minsAgo(600));
    expect(nextVisit(stored, later).previousSeenAt).toBe(minsAgo(600));
  });
});

describe("reply recipient", () => {
  const base = { replyTo: null, fromEmail: null, portal: null, clientEmail: null, body: null, mailboxEmail: "agent@example.test", portalDomains: ["ingatlan.com"] };

  it("prefers Reply-To, then the client, then a human sender", () => {
    expect(replyRecipient({ ...base, replyTo: "Vevo@Example.test", fromEmail: "x@example.test" })).toBe("vevo@example.test");
    expect(replyRecipient({ ...base, clientEmail: "kata@example.test", fromEmail: "x@example.test" })).toBe("kata@example.test");
    expect(replyRecipient({ ...base, fromEmail: "peter@example.test" })).toBe("peter@example.test");
  });

  it("never replies to a portal or no-reply address, or to the agent", () => {
    expect(replyRecipient({ ...base, portal: "ingatlan.com", fromEmail: "info@ingatlan.com" })).toBeNull();
    expect(replyRecipient({ ...base, fromEmail: "noreply@bank.example" })).toBeNull();
    expect(replyRecipient({ ...base, replyTo: "agent@example.test" })).toBeNull();
  });

  it("uses the single address written in a portal email", () => {
    const body = "Érdeklődő: Kiss Éva, e-mail: eva.kiss@example.test. Válasz: info@ingatlan.com";
    expect(replyRecipient({ ...base, portal: "ingatlan.com", fromEmail: "info@ingatlan.com", body })).toBe("eva.kiss@example.test");
    expect(replyRecipient({ ...base, portal: "ingatlan.com", body: "a@example.test vagy b@example.test" })).toBeNull();
  });
});

describe("helpers", () => {
  it("finds a listing by reference or full title", () => {
    const props = [
      { id: "1", name: "Napfényes 2 hálós lakás erkéllyel", reference: "TESZT-001" },
      { id: "2", name: "Ház", reference: null },
    ];
    expect(findMentionedProperty("Érdeklődöm a teszt-001 hirdetés iránt", props)?.id).toBe("1");
    expect(findMentionedProperty("A Napfényes 2 hálós lakás erkéllyel még elérhető?", props)?.id).toBe("1");
    // Short titles are too generic to match on.
    expect(findMentionedProperty("Egy ház érdekelne", props)).toBeUndefined();
  });

  it("builds a reply subject once", () => {
    expect(replySubject("Érdeklődés")).toBe("Re: Érdeklődés");
    expect(replySubject("RE: Érdeklődés")).toBe("RE: Érdeklődés");
    expect(replySubject(null)).toBe("Válasz");
  });

  it("opens Gmail compose prefilled, without sending", () => {
    const url = new URL(gmailComposeUrl({ account: "agent@example.test", to: "eva@example.test", subject: "Re: Lakás", body: "Kedves Éva,\n[időpont]" }));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      view: "cm",
      fs: "1",
      su: "Re: Lakás",
      body: "Kedves Éva,\n[időpont]",
      to: "eva@example.test",
      authuser: "agent@example.test",
    });
  });

  it("summarises what came in as one sentence", () => {
    expect(awayHeadline({ inquiries: 2, clientEmails: 1, otherEmails: 0, tasksDue: 3 })).toBe("2 új érdeklődés, 1 levél ügyféltől és 3 teendő lett esedékes.");
    expect(awayHeadline({ inquiries: 0, clientEmails: 0, otherEmails: 1, tasksDue: 0 })).toBe("1 egyéb levél.");
    expect(awayHeadline({ inquiries: 0, clientEmails: 0, otherEmails: 0, tasksDue: 0 })).toBeNull();
  });
});
