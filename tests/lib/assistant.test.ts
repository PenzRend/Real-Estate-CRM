import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseAnswer, parseInline } from "@/lib/assistant/format";
import { citedSources, messagesFor } from "@/lib/assistant/run";
import { runTool, SourceRegistry, toolJsonSchemas, toolSchemas } from "@/lib/assistant/tools";

describe("parseAnswer", () => {
  it("splits paragraphs and bullet lists, keeping citations and bold", () => {
    const blocks = parseAnswer("Ma két teendőd van:\n\n- **Visszahívni** Pétert [S1]\n* Alaprajz küldése [S2][S3]\n\nTöbb nincs.");
    expect(blocks).toEqual([
      { kind: "paragraph", parts: [{ kind: "text", text: "Ma két teendőd van:" }] },
      {
        kind: "list",
        items: [
          [{ kind: "bold", text: "Visszahívni" }, { kind: "text", text: " Pétert " }, { kind: "cite", ref: "S1" }],
          [{ kind: "text", text: "Alaprajz küldése " }, { kind: "cite", ref: "S2" }, { kind: "cite", ref: "S3" }],
        ],
      },
      { kind: "paragraph", parts: [{ kind: "text", text: "Több nincs." }] },
    ]);
  });

  it("accepts the citation styles models actually write", () => {
    const cites = (s: string) => parseInline(s).filter((p) => p.kind === "cite").map((p) => (p as { ref: string }).ref);
    expect(cites("a [ S1 ] b")).toEqual(["S1"]);
    expect(cites("a [S1, S2] b [S3; S4]")).toEqual(["S1", "S2", "S3", "S4"]);
    expect(cites("a [S1][S2]")).toEqual(["S1", "S2"]);
    expect(cites("a [Sx] [1]")).toEqual([]);
    expect(cites("parkolás fontos [ S1 → requirements ].")).toEqual(["S1"]);
    expect(parseInline("Illő: *Napfényes lakás* [S4]")).toEqual([
      { kind: "text", text: "Illő: " },
      { kind: "text", text: "Napfényes lakás" },
      { kind: "text", text: " " },
      { kind: "cite", ref: "S4" },
    ]);
    expect(cites("Megtaláltam Teszt Katát (ref S1). Itt (S2, S3).")).toEqual(["S1", "S2", "S3"]);
    // A bullet-style asterisk inside a sentence is not emphasis.
    expect(parseInline("2 * 3 = 6")).toEqual([{ kind: "text", text: "2 * 3 = 6" }]);
  });

  it("keeps HTML-looking text as plain text (rendered escaped by React)", () => {
    expect(parseInline("<b>x</b> [S9]")).toEqual([{ kind: "text", text: "<b>x</b> " }, { kind: "cite", ref: "S9" }]);
  });
});

describe("sources", () => {
  it("numbers each record once and returns only the cited ones, in order", () => {
    const r = new SourceRegistry();
    const a = r.add("client", "c1", "Teszt Péter", "/clients/c1");
    const b = r.add("property", "p1", "Napfényes lakás", "/properties/p1");
    expect(r.add("client", "c1", "Teszt Péter", "/clients/c1")).toBe(a);
    expect([a, b]).toEqual(["S1", "S2"]);
    expect(citedSources("Lakás [S2], ügyfél [S1], újra [S2], ismeretlen [S7].", r).map((s) => s.id)).toEqual(["p1", "c1"]);
  });
});

describe("tool definitions", () => {
  it("are lookups, plus a fixed list of actions that say what they do", () => {
    const names = toolJsonSchemas().map((t) => t.name);
    expect(names.sort()).toEqual(Object.keys(toolSchemas).sort());
    const actions = ["create_task", "add_note", "set_follow_up", "create_client", "create_contract", "draft_email", "book_viewing", "move_deal", "open_page"];
    for (const name of names) if (!actions.includes(name)) expect(name).toMatch(/^(search|get|list|recent|find)_/);
    for (const t of toolJsonSchemas()) expect(t.parameters.type).toBe("object");
    for (const t of toolJsonSchemas().filter((t) => ["book_viewing", "move_deal"].includes(t.name))) expect(t.description).toMatch(/^PREPARES/);
    for (const t of toolJsonSchemas().filter((t) => ["create_task", "add_note", "create_client", "create_contract", "draft_email"].includes(t.name))) expect(t.description).toMatch(/^DOES IT/);
    expect(toolJsonSchemas().find((t) => t.name === "draft_email")?.description).toContain("NOT sent");
  });

  it("refuse to act for other AI features (no outcome given)", async () => {
    const r = JSON.parse(await runTool({ user: {} as never, sources: new SourceRegistry(), now: new Date() }, "create_task", { title: "Visszahívni Pétert" }));
    expect(r.error).toMatch(/not available/);
  });

  it("only open pages inside Flavio", () => {
    expect(toolSchemas.open_page.safeParse({ href: "/clients/123" }).success).toBe(true);
    expect(toolSchemas.open_page.safeParse({ href: "https://example.com" }).success).toBe(false);
    expect(toolSchemas.open_page.safeParse({ href: "//evil.example" }).success).toBe(false);
  });

  it("reject ids the model made up", () => {
    expect(toolSchemas.get_client.safeParse({ client_id: "Péter" }).success).toBe(false);
    expect(toolSchemas.find_matches.safeParse({}).success).toBe(false);
    expect(toolSchemas.recent_interactions.parse({}).days).toBe(7);
  });
});

describe("nameStems", () => {
  it("finds names written with Hungarian suffixes", async () => {
    const { nameStems } = await import("@/lib/db/clients");
    const { searchTerm } = await import("@/lib/search");
    expect(nameStems(searchTerm("Teszt Katáról"))).toEqual(["tesz", "kata"]);
    expect(nameStems(searchTerm("Péternek"))).toEqual(["pete"]);
    // Every stem must occur in the stored, normalized name.
    for (const stem of nameStems(searchTerm("Teszt Katával"))) expect("teszt kata teszt.kata@example.test").toContain(stem);
  });
});

describe("messagesFor", () => {
  const call = { id: "c1", type: "function" as const, function: { name: "create_task", arguments: '{"title":"Visszahívni"}' } };
  const messages = [
    { role: "system" as const, content: "S" },
    { role: "user" as const, content: "Írj fel egy feladatot" },
    { role: "assistant" as const, content: null, tool_calls: [call], _model: "groq-model" },
    { role: "tool" as const, tool_call_id: "c1", content: '{"done":true,"ref":"S1"}' },
  ];
  it("keeps tool calls for the provider that made them, without the private tag", () => {
    const out = messagesFor(messages, "groq-model");
    expect(out[2]).toEqual({ role: "assistant", content: null, tool_calls: [call] });
    expect(out[3]).toEqual(messages[3]);
  });
  it("hands another provider's steps over as text, so nothing is done twice", () => {
    const out = messagesFor(messages, "gemini-model");
    expect(out).toHaveLength(3);
    expect(out[2].role).toBe("user");
    expect(out[2].content).toContain('create_task({"title":"Visszahívni"}) → {"done":true,"ref":"S1"}');
    expect(out[2].content).toContain("do not repeat");
  });
});
