import { zip } from "./zip";

// Packages the browser extension (the repository's `extension/` folder) for
// download, pointed at the CRM it was downloaded from: its bridge script runs
// on that CRM's pages and the popup sends imports there, with no settings to
// change after install.

export const EXTENSION_FOLDER = "ingatlan-crm-bovitmeny";
export const EXTENSION_FILES = ["manifest.json", "background.js", "bridge.js", "collect.js", "handoff.js", "permission.html", "permission.js", "popup.html", "popup.js"];

const DEV_ORIGIN = "http://localhost:3000";

/** "https://crm.example.hu" from any http(s) origin; null otherwise. */
export function cleanOrigin(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

/** The extension's files, rewritten from the development address to `origin`. */
export function tailor(files: Record<string, string>, origin: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, text] of Object.entries(files)) {
    if (name === "manifest.json") {
      const manifest = JSON.parse(text) as { content_scripts?: { matches: string[] }[] };
      for (const cs of manifest.content_scripts ?? []) cs.matches = cs.matches.map((m) => (m === `${DEV_ORIGIN}/*` ? `${origin}/*` : m));
      out[name] = `${JSON.stringify(manifest, null, 2)}\n`;
    } else {
      out[name] = text.split(DEV_ORIGIN).join(origin);
    }
  }
  return out;
}

/** The tailored extension as a zip with one folder, ready for "Load unpacked". */
export function extensionZip(files: Record<string, string>, origin: string, at?: Date) {
  const enc = new TextEncoder();
  const tailored = tailor(files, origin);
  return zip(
    Object.entries(tailored).map(([name, text]) => ({ name: `${EXTENSION_FOLDER}/${name}`, data: enc.encode(text) })),
    at,
  );
}
