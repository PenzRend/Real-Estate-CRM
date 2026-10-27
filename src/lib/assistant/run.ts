import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { relativeDayTable } from "@/lib/ai/capture-prompt";
import { llmConfig, type LlmConfig } from "@/lib/ai/config";
import { AiError, postWithRetry, readJson } from "@/lib/ai/extract";
import type { CurrentUser } from "@/lib/auth";
import { runTool, SourceRegistry, toolJsonSchemas, type Source } from "./tools";

const MAX_STEPS = 8;

export const ASSISTANT_SYSTEM_PROMPT = `You are the assistant inside Flavio, a Hungarian real estate agent's CRM. Answer in Hungarian, briefly and concretely, like a capable colleague. Tool results use English field names; never copy them into the answer (budget → keret, follow-up → utánkövetés).

Rules:
- You only know what the tools return. For every new question, call at least one tool before answering, even if an earlier answer seems to cover it: data changes. Never answer from general knowledge or memory, and never invent names, numbers, dates or events.
- "Who/what to follow up today", "my to-dos", "what's due": call list_tasks with view "today" and "overdue"; they include tasks and client follow-up dates.
- Every record in a tool result has a "ref" such as "S3". When you state something that comes from a record, cite it right after the statement as [S3] (no spaces inside the brackets; several as [S3][S4]). Cite every client, listing, task, conversation or email you mention.
- If the tools return nothing relevant, say clearly that the CRM has no such data. Do not guess.
- Give exact dates and amounts from the records (dates as they appear, amounts in forints, e.g. 80 000 000 Ft or 80 M Ft).
- "Where/how can I …" questions about using Flavio (booking a viewing, uploading photos, connecting Gmail, …): call get_app_help and answer from it with the screen and the buttons to press, in a short step list, citing the screen like any record. Only describe screens and buttons get_app_help lists; if it has nothing for the request, say Flavio does not do that yet.
- You can only read. You cannot send emails, call anyone, create or change tasks or records. If asked to, say so in one sentence and point to the matching feature from get_app_help. You yourself never send anything: for a send request about an incoming email, point to "Válaszvázlat"; otherwise say the agent should send it from their own email program or phone, and you may offer the short text to paste.
- If a client search finds nothing, try again with only the first name or the family name before saying the client does not exist.
- For "today", "this week" and similar, use the dates given in the context.
- Prefer short answers: a sentence or a short bullet list. No preamble.`;

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantAnswer = { answer: string; sources: Source[]; model: string; inputTokens: number; outputTokens: number };

function contextMessage(user: CurrentUser, now: Date) {
  return `Context (not from the user):
Today and day expressions (Europe/Budapest):
${relativeDayTable(now)}
The agent: ${user.fullName ?? user.email}, workspace "${user.organization.name}".`;
}

/** Keeps only the sources the answer actually cites, in citation order. */
export function citedSources(answer: string, registry: SourceRegistry): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const match of answer.matchAll(/S\d+/g)) {
    const ref = match[0];
    if (seen.has(ref)) continue;
    seen.add(ref);
    const source = registry.get(ref);
    if (source) out.push(source);
  }
  return out;
}

async function runWithClaude(config: Extract<LlmConfig, { provider: "anthropic" }>, system: string, history: ChatTurn[], ctx: { user: CurrentUser; now: Date; sources: SourceRegistry }) {
  const client = new Anthropic();
  const tools: Anthropic.Beta.BetaTool[] = toolJsonSchemas().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Beta.BetaTool["input_schema"],
  }));
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: config.model,
        // On a safety decline the API retries on a suitable fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        max_tokens: 16000,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools,
        messages,
        output_config: { effort: "medium" },
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) throw new AiError("rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
      if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic ${error.status}`, "Az AI-asszisztens most nem érhető el. Próbáld újra.");
      throw error;
    }
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;
    if (response.stop_reason === "refusal") throw new AiError("refusal", "Erre a kérdésre nem tudok válaszolni.");

    if (response.stop_reason !== "tool_use") {
      const answer = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      return { answer, model: response.model, inputTokens, outputTokens };
    }
    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      results.push({ type: "tool_result", tool_use_id: block.id, content: await runTool(ctx, block.name, block.input) });
    }
    messages.push({ role: "user", content: results });
  }
  throw new AiError("too many steps", "A kérdés túl összetett volt. Próbáld konkrétabban.");
}

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

async function runWithOpenAiCompatible(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  system: string,
  history: ChatTurn[],
  ctx: { user: CurrentUser; now: Date; sources: SourceRegistry },
) {
  const tools = toolJsonSchemas().map((t) => ({ type: "function" as const, function: t }));
  const messages: OpenAiMessage[] = [{ role: "system", content: system }, ...history.map((t) => ({ role: t.role, content: t.content }))];
  let inputTokens = 0;
  let outputTokens = 0;
  let model = config.model;
  let forceTool = true;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await postWithRetry(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      // The first step must look something up, so an answer is never made from nothing.
      body: JSON.stringify({ model: config.model, messages, tools, tool_choice: step === 0 && forceTool ? "required" : "auto" }),
    });
    if (res.status === 429) {
      console.error("assistant 429", (await res.text()).slice(0, 300));
      throw new AiError("rate limit", "Az AI-szolgáltatás most túlterhelt. Próbáld újra egy perc múlva.");
    }
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      // Groq rejects a forced tool call when the model insists on answering
      // directly (e.g. declining a request); let it answer once that happens.
      if (res.status === 400 && step === 0 && forceTool && detail.includes("tool")) {
        forceTool = false;
        step--;
        continue;
      }
      console.error("assistant provider", res.status, detail);
      throw new AiError(`provider ${res.status}`, "Az AI-asszisztens most nem érhető el. Próbáld újra.");
    }
    const body = (await readJson(res)) as {
      model?: string;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      choices?: { finish_reason?: string; message?: Extract<OpenAiMessage, { role: "assistant" }> }[];
    };
    model = body.model ?? model;
    inputTokens += body.usage?.prompt_tokens ?? 0;
    outputTokens += body.usage?.completion_tokens ?? 0;
    const message = body.choices?.[0]?.message;
    if (!message) throw new AiError("empty response", "Az AI-asszisztens nem válaszolt. Próbáld újra.");

    if (!message.tool_calls?.length) {
      // Some models emit stray control characters (seen: a trailing NUL).
      const answer = (message.content ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
      return { answer, model, inputTokens, outputTokens };
    }
    messages.push({ role: "assistant", content: message.content ?? null, tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      let args: unknown = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = null; // runTool reports invalid arguments back to the model
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(ctx, call.function.name, args) });
    }
  }
  throw new AiError("too many steps", "A kérdés túl összetett volt. Próbáld konkrétabban.");
}

/** Answers a question using only read-only CRM tools; returns the answer and the records it cites. */
export async function askAssistant(user: CurrentUser, history: ChatTurn[], now: Date): Promise<AssistantAnswer> {
  const config = llmConfig();
  if (!config) throw new AiError("No AI provider configured", "Az AI most nem érhető el. Próbáld újra később, vagy jelezd nekünk a Visszajelzés gombbal.");
  const sources = new SourceRegistry();
  const ctx = { user, now, sources };
  // The context goes first as a user turn so the system prompt stays identical (and cacheable).
  const turns: ChatTurn[] = [{ role: "user", content: contextMessage(user, now) }, { role: "assistant", content: "Rendben." }, ...history];
  const result =
    config.provider === "anthropic"
      ? await runWithClaude(config, ASSISTANT_SYSTEM_PROMPT, turns, ctx)
      : await runWithOpenAiCompatible(config, ASSISTANT_SYSTEM_PROMPT, turns, ctx);
  if (!result.answer) throw new AiError("empty answer", "Az AI-asszisztens nem adott választ. Próbáld újra.");
  return { ...result, sources: citedSources(result.answer, sources) };
}
