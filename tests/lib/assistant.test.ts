import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseAnswer, parseInline } from "@/lib/assistant/format";
import { citedSources } from "@/lib/assistant/run";
import { SourceRegistry, toolJsonSchemas, toolSchemas } from "@/lib/assistant/tools";

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
  it("are all read-only lookups with JSON schemas", () => {
    const names = toolJsonSchemas().map((t) => t.name);
    expect(names).toEqual(Object.keys(toolSchemas));
    for (const name of names) expect(name).toMatch(/^(search|get|list|recent|find)_/);
    for (const t of toolJsonSchemas()) expect(t.parameters.type).toBe("object");
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
