import { zip } from "./zip.ts";

// Packages the browser extension (the repository's `extension/` folder),
// pointed at one CRM: its bridge script runs on that CRM's pages and the popup
// sends imports there, with no settings to change after install. Used by the
// download on the import page and by `npm run extension:pack` for the stores.

export const EXTENSION_FOLDER = "ingatlan-crm-bovitmeny";
export const EXTENSION_FILES = [
  "manifest.json",
  "background.js",
  "bridge.js",
  "collect.js",
  "handoff.js",
  "permission.html",
  "permission.js",
  "popup.html",
  "popup.js",
  "icons/icon16.png",
  "icons/icon32.png",
  "icons/icon48.png",
  "icons/icon128.png",
];

const DEV_ORIGIN = "http://localhost:3000";
const isText = (name: string) => /\.(json|js|html)$/.test(name);

/** "https://crm.example.hu" from any http(s) origin; null otherwise. */
export function cleanOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** The extension's files, rewritten from the development address to `origin`. Binary files pass through. */
export function tailor(files: Record<string, Uint8Array>, origin: string): Record<string, Uint8Array> {
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const out: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (!isText(name)) {
      out[name] = data;
    } else if (name === "manifest.json") {
      const manifest = JSON.parse(dec.decode(data)) as { content_scripts?: { matches: string[] }[] };
      for (const cs of manifest.content_scripts ?? []) cs.matches = cs.matches.map((m) => (m === `${DEV_ORIGIN}/*` ? `${origin}/*` : m));
      out[name] = enc.encode(`${JSON.stringify(manifest, null, 2)}\n`);
    } else {
      out[name] = enc.encode(dec.decode(data).split(DEV_ORIGIN).join(origin));
    }
  }
  return out;
}

/**
 * The tailored extension as a zip: inside one folder for "Load unpacked"
 * (the default), or at the root for a store upload (`folder: null`).
 */
export function extensionZip(files: Record<string, Uint8Array>, origin: string, { folder = EXTENSION_FOLDER as string | null, at }: { folder?: string | null; at?: Date } = {}) {
  const prefix = folder ? `${folder}/` : "";
  return zip(
    Object.entries(tailor(files, origin)).map(([name, data]) => ({ name: `${prefix}${name}`, data })),
    at,
  );
}
