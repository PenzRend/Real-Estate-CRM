import { NextResponse, type NextRequest } from "next/server";
import { AiError } from "@/lib/ai/extract";
import { MAX_AUDIO_BYTES, transcribe } from "@/lib/ai/transcribe";
import { aiLimitMessage, logAiUsage } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";

/**
 * Voice memo → text. The audio is sent to the transcription provider and not
 * stored; the agent sees and can edit the text before anything is saved.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  const limit = await aiLimitMessage(user);
  if (limit) return NextResponse.json({ error: limit }, { status: 429 });

  let audio: FormDataEntryValue | null;
  try {
    audio = (await request.formData()).get("audio");
  } catch {
    return NextResponse.json({ error: "A hangfelvétel nem érkezett meg." }, { status: 400 });
  }
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: "A hangfelvétel üres." }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "A felvétel túl hosszú. Legfeljebb kb. 20 perc lehet." }, { status: 413 });
  }
  if (!audio.type.startsWith("audio/") && !audio.type.startsWith("video/webm")) {
    return NextResponse.json({ error: "Ismeretlen hangformátum." }, { status: 415 });
  }

  try {
    const { text, model } = await transcribe(audio);
    await logAiUsage(user, { status: "success", model });
    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof AiError) {
      await logAiUsage(user, { status: "error" });
      console.error("transcribe", error.message);
      return NextResponse.json({ error: error.userMessage }, { status: 502 });
    }
    throw error;
  }
}
