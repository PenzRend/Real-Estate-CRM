import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { llmConfig } from "./config";
import { AiError, callChatCompletions } from "./extract";

export type StructuredResult<T> = { data: T; model: string; inputTokens: number | null; outputTokens: number | null };

/**
 * One model call that must return an object matching `schema`, on whichever
 * provider is configured. Errors become AiError with a Hungarian message.
 */
export async function structuredCall<S extends z.ZodType>(
  schema: S,
  system: string,
  prompt: string,
  opts: { maxTokens?: number; failMessage: string; maxWaitSeconds?: number },
): Promise<StructuredResult<z.infer<S>>> {
  const config = llmConfig();
  if (!config) throw new AiError("No AI provider configured", "Az AI-szolgáltatás még nincs beállítva.");

  if (config.provider === "anthropic") {
    const client = new Anthropic();
    try {
      const response = await client.beta.messages.parse({
        model: config.model,
        max_tokens: opts.maxTokens ?? 8000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: prompt }],
        output_config: { effort: "low", format: betaZodOutputFormat(schema) },
      });
      if (!response.parsed_output) throw new AiError(`No parsed output (stop_reason: ${response.stop_reason})`, opts.failMessage);
      return { data: response.parsed_output as z.infer<S>, model: response.model, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens };
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) throw new AiError("rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
      if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic ${error.status}`, opts.failMessage);
      throw error;
    }
  }

  const jsonSchema = z.toJSONSchema(schema);
  let res = await callChatCompletions(
    config,
    [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    { type: "json_schema", json_schema: { name: "result", strict: true, schema: jsonSchema } },
    { maxTokens: opts.maxTokens, maxWaitSeconds: opts.maxWaitSeconds },
  );
  // Providers without strict JSON-schema support: plain JSON mode with the schema in the instructions.
  if (res.status === 400) {
    console.error("ai 400 (strict schema)", (await res.text()).slice(0, 300));
    res = await callChatCompletions(
      config,
      [
        { role: "system", content: `${system}\n\nRespond with one JSON object only, matching this JSON Schema exactly (all keys required, null when unknown):\n${JSON.stringify(jsonSchema)}` },
        { role: "user", content: prompt },
      ],
      { type: "json_object" },
      { maxTokens: opts.maxTokens, maxWaitSeconds: opts.maxWaitSeconds },
    );
  }
  if (res.status === 429) {
    console.error("ai 429", (await res.text()).slice(0, 300));
    throw new AiError("rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
  }
  if (!res.ok) {
    console.error(`ai ${res.status}`, (await res.text()).slice(0, 300));
    throw new AiError(`provider ${res.status}`, opts.failMessage);
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number }; model?: string };
  let json: unknown;
  try {
    json = JSON.parse(body.choices?.[0]?.message?.content ?? "");
  } catch {
    throw new AiError("invalid JSON", "Az AI válasza nem volt értelmezhető. Próbáld újra.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiError("output failed validation", "Az AI válasza hiányos volt. Próbáld újra.");
  return { data: parsed.data, model: body.model ?? config.model, inputTokens: body.usage?.prompt_tokens ?? null, outputTokens: body.usage?.completion_tokens ?? null };
}
