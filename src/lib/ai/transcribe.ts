import "server-only";
import { transcriptionConfig } from "./config";
import { AiError } from "./extract";

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // provider limit for one upload

/** Speech to text through an OpenAI-compatible /audio/transcriptions endpoint. Audio is not stored. */
export async function transcribe(audio: File): Promise<{ text: string; model: string }> {
  const config = transcriptionConfig();
  if (!config) throw new AiError("No transcription provider configured", "A hangfelismerés még nincs beállítva.");

  const form = new FormData();
  form.append("file", audio, audio.name || "memo.webm");
  form.append("model", config.model);
  form.append("language", "hu");
  form.append("response_format", "json");

  const res = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 429) throw new AiError("Transcription rate limit", "A hangfelismerés most túlterhelt. Próbáld újra egy perc múlva.");
  if (!res.ok) throw new AiError(`Transcription error ${res.status}`, "A hangfelvétel feldolgozása nem sikerült.");
  const body = (await res.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) throw new AiError("Empty transcription", "Nem hallottunk beszédet a felvételen.");
  return { text, model: config.model };
}
