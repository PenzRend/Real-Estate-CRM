import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { postChat, shouldFallBack } = await import("@/lib/ai/extract");

const primary = { provider: "openai-compatible" as const, baseUrl: "https://main.test/v1", apiKey: "k1", model: "openai/gpt-oss-120b" };
const fetchMock = vi.fn<typeof fetch>();

function sentTo() {
  return fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(String(init?.body)) }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AI_FALLBACK_BASE_URL", "https://backup.test/v1/");
  vi.stubEnv("AI_FALLBACK_API_KEY", "k2");
  vi.stubEnv("AI_FALLBACK_MODEL", "gemini-flash-latest");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("postChat", () => {
  it("sends the same request to the backup when the main provider is out of quota", async () => {
    fetchMock.mockResolvedValueOnce(new Response("limit", { status: 429 })).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    const res = await postChat(primary, (model) => ({ messages: [], ...(model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}) }));
    expect(res.status).toBe(200);
    const [first, second] = sentTo();
    expect(first).toMatchObject({ url: "https://main.test/v1/chat/completions", body: { model: "openai/gpt-oss-120b", reasoning_effort: "low" } });
    expect(second).toMatchObject({ url: "https://backup.test/v1/chat/completions", body: { model: "gemini-flash-latest" } });
    expect(second.body).not.toHaveProperty("reasoning_effort");
  });

  it("uses the backup when the main provider can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(new Response("{}", { status: 200 }));
    expect((await postChat(primary, () => ({}))).status).toBe(200);
    expect(sentTo()[1].url).toBe("https://backup.test/v1/chat/completions");
  });

  it("keeps the main provider's answer when it isn't a quota or outage error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad schema", { status: 400 }));
    expect((await postChat(primary, () => ({}))).status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("without a backup configured, returns the 429 as is", async () => {
    vi.stubEnv("AI_FALLBACK_MODEL", "");
    fetchMock.mockResolvedValueOnce(new Response("limit", { status: 429 }));
    expect((await postChat(primary, () => ({}))).status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("shouldFallBack", () => {
  it("is for quota, outages and requests over the main provider's per-minute budget", () => {
    expect([413, 429, 498, 500, 503].map(shouldFallBack)).toEqual([true, true, true, true, true]);
    expect([200, 400, 401, 404].map(shouldFallBack)).toEqual([false, false, false, false]);
  });
});
