"use client";

// Photos chosen during an import wait here until the listing is saved; the
// property page then uploads them like any other photo (resized, metadata
// removed). Kept in this browser only and cleared after the upload.
//
// - The selection (which photo addresses, and where to get them) is in
//   sessionStorage, keyed by the listing's canonical source address.
// - Photos the browser extension already downloaded are in IndexedDB, written
//   by its bridge script on this origin (same database and store names).

export const IDB_NAME = "crm-import";
export const IDB_STORE = "images";

export type PendingSelection = { images: string[]; source: "server" | "extension" };

const KEY = (sourceUrl: string) => `crm-import-media:${sourceUrl}`;

export function savePending(sourceUrl: string, selection: PendingSelection) {
  try {
    sessionStorage.setItem(KEY(sourceUrl), JSON.stringify(selection));
  } catch {
    // storage unavailable: the photos simply aren't imported
  }
}

export function readPending(sourceUrl: string): PendingSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY(sourceUrl));
    const v = raw ? (JSON.parse(raw) as PendingSelection) : null;
    return v && Array.isArray(v.images) && v.images.length ? v : null;
  } catch {
    return null;
  }
}

export function clearPending(sourceUrl: string) {
  try {
    sessionStorage.removeItem(KEY(sourceUrl));
  } catch {
    // nothing to clear
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Key of a downloaded photo: the listing it belongs to and the photo's own address. */
export const imageKey = (sourceUrl: string, imageUrl: string) => `${sourceUrl}|${imageUrl}`;

export async function getStoredImage(sourceUrl: string, imageUrl: string): Promise<Blob | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(imageKey(sourceUrl, imageUrl));
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Removes every stored photo of one listing. */
export async function clearStoredImages(sourceUrl: string) {
  try {
    const db = await openDb();
    const store = db.transaction(IDB_STORE, "readwrite").objectStore(IDB_STORE);
    const range = IDBKeyRange.bound(`${sourceUrl}|`, `${sourceUrl}|￿`);
    store.delete(range);
  } catch {
    // nothing stored
  }
}

/** A photo for upload: from the extension's download, or through the CRM for portals that allow it. */
export async function loadPendingImage(sourceUrl: string, imageUrl: string, source: PendingSelection["source"]): Promise<File | null> {
  let blob = source === "extension" ? await getStoredImage(sourceUrl, imageUrl) : null;
  if (!blob) {
    try {
      const res = await fetch(`/api/listing-image?url=${encodeURIComponent(imageUrl)}`);
      blob = res.ok ? await res.blob() : null;
    } catch {
      blob = null;
    }
  }
  if (!blob || !/^image\/(jpeg|png|webp)$/.test(blob.type)) return null;
  const name = decodeURIComponent(new URL(imageUrl).pathname.split("/").pop() || "foto") || "foto";
  return new File([blob], name, { type: blob.type });
}

/** Preview address for the review screen; null while the extension is still downloading it. */
export async function previewUrl(sourceUrl: string, imageUrl: string, source: PendingSelection["source"]) {
  if (source === "server") return `/api/listing-image?url=${encodeURIComponent(imageUrl)}`;
  const blob = await getStoredImage(sourceUrl, imageUrl);
  return blob ? URL.createObjectURL(blob) : null;
}
