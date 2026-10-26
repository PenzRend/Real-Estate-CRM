import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CAPTURE_SYSTEM_PROMPT, captureUserPrompt } from "./capture-prompt";
import { captureExtractionSchema, cleanExtraction, type CaptureExtraction } from "./capture-schema";
import { llmConfig, type LlmConfig } from "./config";

export class AiError extends Error {
  constructor(
    message: string,
    /** Safe to show to the user (Hungarian). */
    readonly userMessage: string,
  ) {
    super(message);
  }
}

export type ExtractionResult = {
  extraction: CaptureExtraction;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

async function extractWithClaude(config: Extract<LlmConfig, { provider: "anthropic" }>, prompt: string): Promise<ExtractionResult> {
  const client = new Anthropic();
  let response;
  try {
    response = await client.beta.messages.parse({
      model: config.model,
      max_tokens: 16000,
      // On a safety decline the API retries on a suitable fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: CAPTURE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: prompt }],
      output_config: { effort: "medium", format: betaZodOutputFormat(captureExtractionSchema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiError("Anthropic rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
    }
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiError("Anthropic authentication failed", "Az AI-szolgáltatás nincs jól beállítva (érvénytelen kulcs).");
    }
    if (error instanceof Anthropic.APIError) {
      throw new AiError(`Anthropic API error ${error.status}`, "Az AI-feldolgozás nem sikerült. Próbáld újra.");
    }
    throw error;
  }
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new AiError(`No parsed output (stop_reason: ${response.stop_reason})`, "Az AI nem tudta feldolgozni ezt a szöveget.");
  }
  return {
    extraction: cleanExtraction(response.parsed_output),
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

async function callChatCompletions(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  messages: { role: "system" | "user"; content: string }[],
  responseFormat: object,
) {
  return fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({ model: config.model, messages, response_format: responseFormat }),
    signal: AbortSignal.timeout(90_000),
  });
}

async function extractWithOpenAiCompatible(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  prompt: string,
): Promise<ExtractionResult> {
  const schema = z.toJSONSchema(captureExtractionSchema);
  let res = await callChatCompletions(
    config,
    [
      { role: "system", content: CAPTURE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    { type: "json_schema", json_schema: { name: "capture", strict: true, schema } },
  );
  // Providers without strict JSON-schema support: plain JSON mode with the schema in the instructions.
  if (res.status === 400) {
    res = await callChatCompletions(
      config,
      [
        {
          role: "system",
          content: `${CAPTURE_SYSTEM_PROMPT}

Respond with one JSON object only, matching this JSON Schema exactly (all keys required, null when unknown):
${JSON.stringify(schema)}`,
        },
        { role: "user", content: prompt },
      ],
      { type: "json_object" },
    );
  }
  if (res.status === 429) throw new AiError("Provider rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
  if (!res.ok) throw new AiError(`Provider error ${res.status}`, "Az AI-feldolgozás nem sikerült. Próbáld újra.");

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  const content = body.choices?.[0]?.message?.content ?? "";
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    throw new AiError("Provider returned invalid JSON", "Az AI válasza nem volt értelmezhető. Próbáld újra.");
  }
  const parsed = captureExtractionSchema.safeParse(json);
  if (!parsed.success) throw new AiError("Provider output failed validation", "Az AI válasza hiányos volt. Próbáld újra.");
  return {
    extraction: cleanExtraction(parsed.data),
    model: body.model ?? config.model,
    inputTokens: body.usage?.prompt_tokens ?? null,
    outputTokens: body.usage?.completion_tokens ?? null,
  };
}

/** Turns free text into structured, validated CRM data. Nothing is saved here. */
export async function extractCapture(text: string, now: Date, knownClientName?: string | null): Promise<ExtractionResult> {
  const config = llmConfig();
  if (!config) throw new AiError("No AI provider configured", "Az AI-szolgáltatás még nincs beállítva.");
  const prompt = captureUserPrompt(text, now, knownClientName);
  return config.provider === "anthropic" ? extractWithClaude(config, prompt) : extractWithOpenAiCompatible(config, prompt);
}
