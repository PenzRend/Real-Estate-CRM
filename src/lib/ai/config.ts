import "server-only";

// Which AI services are configured. Keys stay on the server; see .env.example.

export type LlmConfig =
  | { provider: "anthropic"; model: string }
  | { provider: "openai-compatible"; baseUrl: string; apiKey: string; model: string };

export type TranscriptionConfig = { baseUrl: string; apiKey: string; model: string };

export function llmConfig(): LlmConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic", model: process.env.AI_MODEL || "claude-opus-5-5" };
  }
  const { AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (AI_BASE_URL && AI_API_KEY && AI_MODEL) {
    return { provider: "openai-compatible", baseUrl: AI_BASE_URL.replace(/\/$/, ""), apiKey: AI_API_KEY, model: AI_MODEL };
  }
  return null;
}

/**
 * A second OpenAI-compatible provider, used when the main one is out of quota
 * or down. AI_FALLBACK_MODEL may list several models, comma-separated, tried in
 * order: a "latest" alias can be overloaded for hours while its siblings answer.
 */
export function llmFallbackConfigs(): Extract<LlmConfig, { provider: "openai-compatible" }>[] {
  const { AI_FALLBACK_BASE_URL, AI_FALLBACK_API_KEY, AI_FALLBACK_MODEL } = process.env;
  if (!AI_FALLBACK_BASE_URL || !AI_FALLBACK_API_KEY || !AI_FALLBACK_MODEL) return [];
  const baseUrl = AI_FALLBACK_BASE_URL.replace(/\/$/, "");
  return AI_FALLBACK_MODEL.split(",")
    .map((m) => m.trim())
    .filter(Boolean)
    .map((model) => ({ provider: "openai-compatible" as const, baseUrl, apiKey: AI_FALLBACK_API_KEY, model }));
}

export function transcriptionConfig(): TranscriptionConfig | null {
  const baseUrl = process.env.TRANSCRIBE_BASE_URL || process.env.AI_BASE_URL;
  const apiKey = process.env.TRANSCRIBE_API_KEY || process.env.AI_API_KEY;
  const model = process.env.TRANSCRIBE_MODEL;
  return baseUrl && apiKey && model ? { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model } : null;
}
