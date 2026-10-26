"use client";

import { PHOTO_MAX_SIDE, scaledSize, THUMB_MAX_SIDE } from "./rules";

// Prepares files in the browser before upload. Photos are redrawn at a sensible
// size, which also drops their hidden metadata (phones store the GPS location
// of where a photo was taken). Videos keep their file; a still frame becomes
// the preview.

function canvasBlob(source: CanvasImageSource, width: number, height: number, type: string, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");
  ctx.drawImage(source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, quality),
  );
}

export type PreparedPhoto = { file: Blob; mimeType: string; thumb: Blob; width: number; height: number };

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  // Honours the EXIF rotation, so portrait photos stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = scaledSize(bitmap.width, bitmap.height, PHOTO_MAX_SIDE);
    const small = scaledSize(bitmap.width, bitmap.height, THUMB_MAX_SIDE);
    // PNGs keep transparency (floor plans, drawings); everything else becomes JPEG.
    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const [out, thumb] = await Promise.all([
      canvasBlob(bitmap, full.width, full.height, mimeType, 0.86),
      canvasBlob(bitmap, small.width, small.height, "image/jpeg", 0.8),
    ]);
    return { file: out, mimeType, thumb, width: full.width, height: full.height };
  } finally {
    bitmap.close();
  }
}

export type PreparedVideo = { thumb: Blob | null; width: number | null; height: number | null; duration: number | null };

/** A still frame from about a second in; null fields when the browser can't decode the format (e.g. some MOV files). */
export function prepareVideo(file: File): Promise<PreparedVideo> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    const done = (r: PreparedVideo) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    const timer = setTimeout(() => done({ thumb: null, width: null, height: null, duration: null }), 10_000);
    video.onerror = () => {
      clearTimeout(timer);
      done({ thumb: null, width: null, height: null, duration: null });
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };
    video.onseeked = async () => {
      clearTimeout(timer);
      const meta = { width: video.videoWidth || null, height: video.videoHeight || null, duration: Number.isFinite(video.duration) ? video.duration : null };
      try {
        const size = scaledSize(video.videoWidth, video.videoHeight, THUMB_MAX_SIDE);
        done({ ...meta, thumb: await canvasBlob(video, size.width, size.height, "image/jpeg", 0.8) });
      } catch {
        done({ ...meta, thumb: null });
      }
    };
    video.src = url;
  });
}
