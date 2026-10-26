"use client";

import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const MAX_SECONDS = 15 * 60;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Records a voice memo in the browser and returns its transcript. The audio
 * goes to the server only to be transcribed; it is not stored.
 */
export function VoiceRecorder({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      recorder.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function upload(blob: Blob, type: string) {
    setState("uploading");
    try {
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", new File([blob], `memo.${ext}`, { type: type || "audio/webm" }));
      const res = await fetch("/api/capture/transcribe", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !body.text) throw new Error(body.error ?? "A hangfelvétel feldolgozása nem sikerült.");
      onTranscript(body.text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "A hangfelvétel feldolgozása nem sikerült.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    setError(null);
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setError("Ez a böngésző nem támogatja a hangfelvételt. Írd be a jegyzetet, vagy használd a telefon diktálás funkcióját.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Nincs hozzáférés a mikrofonhoz. Engedélyezd a böngésző beállításaiban.");
      return;
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      void upload(new Blob(chunks, { type: rec.mimeType }), rec.mimeType);
    };
    recorder.current = rec;
    rec.start(1000);
    setSeconds(0);
    setState("recording");
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS && rec.state === "recording") rec.stop();
        return s + 1;
      });
    }, 1000);
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  return (
    <div className="flex flex-col gap-2">
      {state === "recording" ? (
        <button
          type="button"
          onClick={stop}
          className="inline-flex h-12 items-center justify-center gap-3 rounded-full bg-danger px-6 text-sm font-medium text-white"
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-white" />
          </span>
          Felvétel leállítása · <span className="tabular-nums">{clock(seconds)}</span>
          <Square className="size-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={start}
          disabled={disabled || state === "uploading"}
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-background px-6 text-sm font-medium text-ink transition-colors hover:bg-surface",
            "disabled:pointer-events-none disabled:opacity-60",
          )}
        >
          {state === "uploading" ? <Loader2 className="size-4 animate-spin" /> : <Mic className="size-4" />}
          {state === "uploading" ? "Leírás készül…" : "Diktálás"}
        </button>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
