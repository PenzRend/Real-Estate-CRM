"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { addMedia, deleteMedia, moveMedia, setCover } from "@/lib/db/media";

const newMediaSchema = z.object({
  kind: z.enum(["photo", "video"]),
  storagePath: z.string().max(300),
  thumbPath: z.string().max(300).nullable(),
  mimeType: z.enum(["image/jpeg", "image/webp", "image/png", "video/mp4", "video/webm", "video/quicktime"]),
  sizeBytes: z.number().int().positive().max(60 * 1024 * 1024),
  width: z.number().int().positive().max(20_000).nullable(),
  height: z.number().int().positive().max(20_000).nullable(),
  durationSeconds: z.number().nonnegative().max(24 * 3600).nullable(),
});

/** Called after the browser has uploaded a file to storage. */
export async function addMediaAction(propertyId: string, input: unknown) {
  const user = await getCurrentUser();
  const parsed = newMediaSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Hiányos fájladatok." };
  return addMedia(user, propertyId, parsed.data);
}

export async function deleteMediaAction(id: string) {
  const user = await getCurrentUser();
  await deleteMedia(user, id);
  refresh();
}

export async function setCoverAction(id: string) {
  const user = await getCurrentUser();
  await setCover(user, id);
  refresh();
}

export async function moveMediaAction(id: string, direction: -1 | 1) {
  const user = await getCurrentUser();
  await moveMedia(user, id, direction === -1 ? -1 : 1);
  refresh();
}
