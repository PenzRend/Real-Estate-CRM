import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MailAccessRevoked, MailSendNotAllowed } from "@/lib/mail/google";
import { listOutlookMessages, outlookSend } from "@/lib/mail/microsoft";

type Call = { method: string; url: string; body: unknown; prefer: string | null };

/** A fake Graph: answers by "METHOD path" and records every call. */
function fakeGraph(routes: Record<string, (body: unknown) => { status: number; json?: unknown }>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const body = init.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, prefer: new Headers(init.headers).get("Prefer") });
    const path = url.replace("https://graph.microsoft.com/v1.0/me/", "").split("?")[0];
    const handler = routes[`${method} ${path}`];
    const r = handler ? handler(body) : { status: 404 };
    return new Response(r.json ? JSON.stringify(r.json) : null, { status: r.status });
  });
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Outlook sending", () => {
  it("replies in the original conversation: createReply, our text, send", async () => {
    const calls = fakeGraph({
      "POST messages/orig-1/createReply": () => ({ status: 201, json: { id: "draft-1", conversationId: "conv-9" } }),
      "PATCH messages/draft-1": () => ({ status: 200, json: { id: "draft-1" } }),
      "POST messages/draft-1/send": () => ({ status: 202 }),
    });
    const sent = await outlookSend("tok", { to: ["eva@example.test"], subject: "Re: Lakás", body: "Kedves Éva!", replyToId: "orig-1" });
    expect(sent).toEqual({ id: "draft-1", threadId: "conv-9" });
    expect(calls.map((c) => `${c.method} ${c.url.split("/me/")[1]}`)).toEqual(["POST messages/orig-1/createReply", "PATCH messages/draft-1", "POST messages/draft-1/send"]);
    expect(calls[1].body).toEqual({ subject: "Re: Lakás", body: { contentType: "Text", content: "Kedves Éva!" }, toRecipients: [{ emailAddress: { address: "eva@example.test" } }] });
    // Stable ids, so the next sync recognises the sent message in Sent Items.
    expect(calls.every((c) => c.prefer?.includes('IdType="ImmutableId"'))).toBe(true);
  });

  it("sends a new conversation when the original is gone", async () => {
    const calls = fakeGraph({
      "POST messages": () => ({ status: 201, json: { id: "draft-2", conversationId: "conv-2" } }),
      "POST messages/draft-2/send": () => ({ status: 202 }),
    });
    const sent = await outlookSend("tok", { to: ["eva@example.test"], subject: "Ajánlat", body: "Szia!", replyToId: "deleted" });
    expect(sent.id).toBe("draft-2");
    expect(calls.map((c) => `${c.method} ${c.url.split("/me/")[1].split("?")[0]}`)).toEqual(["POST messages/deleted/createReply", "POST messages", "POST messages/draft-2/send"]);
  });

  it("reports a missing send permission and lost access distinctly", async () => {
    fakeGraph({ "POST messages": () => ({ status: 403 }) });
    await expect(outlookSend("tok", { to: ["a@example.test"], subject: "x", body: "y" })).rejects.toBeInstanceOf(MailSendNotAllowed);
    fakeGraph({ "POST messages": () => ({ status: 401 }) });
    await expect(outlookSend("tok", { to: ["a@example.test"], subject: "x", body: "y" })).rejects.toBeInstanceOf(MailAccessRevoked);
  });
});

describe("Outlook listing", () => {
  it("follows the next-page links and stops at the cap", async () => {
    let page = 0;
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: string) => {
      calls.push(String(input));
      page++;
      const value = Array.from({ length: 100 }, (_, i) => ({ id: `m${page}-${i}` }));
      return new Response(JSON.stringify({ value, "@odata.nextLink": `https://graph.microsoft.com/v1.0/me/messages?$skip=${page * 100}` }), { status: 200 });
    });
    const messages = await listOutlookMessages("tok", new Date("2026-10-13T00:00:00Z"), 250);
    expect(messages).toHaveLength(300);
    expect(calls).toHaveLength(3);
    expect(decodeURIComponent(calls[0])).toContain("receivedDateTime ge 2026-10-13T00:00:00.000Z and isDraft eq false");
    expect(calls[1]).toBe("https://graph.microsoft.com/v1.0/me/messages?$skip=100");
  });
});
