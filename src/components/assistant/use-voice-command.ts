"use client";

import { useEffect, useRef, useState } from "react";

// Speak to the assistant: records until the agent stops talking (or taps
// again), then turns the speech into text with the same service as
// "Rögzítés". The audio goes to the server only to be transcribed.

const SILENCE_MS = 1500;
const NOTHING_SAID_MS = 8000;
const MAX_MS = 60_000;
const LOUD = 0.035;

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export function useVoiceCommand(onText: (text: string) => void) {
  const [state, setState] = useState<"idle" | "listening" | "transcribing">("idle");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);
  useEffect(() => () => stopRef.current?.(), []);

  async function transcribe(blob: Blob, type: string) {
    setState("transcribing");
    try {
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", new File([blob], `parancs.${ext}`, { type: type || "audio/webm" }));
      const res = await fetch("/api/capture/transcribe", { method: "POST", body: form });
      const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || !body.text?.trim()) throw new Error(body.error ?? "Nem értettem. Próbáld újra.");
      onTextRef.current(body.text.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nem értettem. Próbáld újra.");
    } finally {
      setState("idle");
    }
  }

  async function start() {
    if (state !== "idle") return;
    setError(null);
    const mimeType = pickMimeType();
    if (mimeType === null || !navigator.mediaDevices?.getUserMedia) {
      setError("Ez a böngésző nem támogatja a hangfelvételt.");
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
    const audio = new AudioContext();
    const analyser = audio.createAnalyser();
    analyser.fftSize = 1024;
    audio.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const began = Date.now();
    let heard = false;
    let lastLoud = began;

    // Stop when the agent has spoken and gone quiet, or never spoke, or talked a long time.
    const tick = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / samples.length);
      setLevel(Math.min(1, rms * 8));
      const now = Date.now();
      if (rms > LOUD) {
        heard = true;
        lastLoud = now;
      }
      if ((heard && now - lastLoud > SILENCE_MS) || (!heard && now - began > NOTHING_SAID_MS) || now - began > MAX_MS) stop();
    }, 100);

    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      void audio.close();
      setLevel(0);
      stopRef.current = null;
      if (!heard) {
        setState("idle");
        setError("Nem hallottam semmit. Koppints a mikrofonra, és mondd, mit csináljak.");
        return;
      }
      void transcribe(new Blob(chunks, { type: rec.mimeType }), rec.mimeType);
    };
    const stop = () => {
      if (rec.state !== "inactive") rec.stop();
    };
    stopRef.current = stop;
    rec.start(250);
    setState("listening");
  }

  return { state, level, error, start, stop: () => stopRef.current?.(), clearError: () => setError(null) };
}
