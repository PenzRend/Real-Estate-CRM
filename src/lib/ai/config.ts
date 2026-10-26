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

export function transcriptionConfig(): TranscriptionConfig | null {
  const baseUrl = process.env.TRANSCRIBE_BASE_URL || process.env.AI_BASE_URL;
  const apiKey = process.env.TRANSCRIBE_API_KEY || process.env.AI_API_KEY;
  const model = process.env.TRANSCRIBE_MODEL;
  return baseUrl && apiKey && model ? { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model } : null;
}
