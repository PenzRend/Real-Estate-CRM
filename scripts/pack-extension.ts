// Builds the store upload of the import extension, pointed at the deployed CRM:
//   npm run extension:pack -- https://crm.example.hu
// (or with APP_URL set). Writes dist/flavio-extension-<version>.zip.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { EXTENSION_FILES, cleanOrigin, extensionZip } from "../src/lib/extension/package.ts";

const origin = cleanOrigin(process.argv[2] ?? process.env.APP_URL ?? "");
if (!origin || !origin.startsWith("https://")) {
  console.error("Add the CRM's https address: npm run extension:pack -- https://crm.example.hu");
  process.exit(1);
}

const dir = path.join(process.cwd(), "extension");
const files = Object.fromEntries(EXTENSION_FILES.map((f) => [f, new Uint8Array(readFileSync(path.join(dir, f)))]));
const { version } = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as { version: string };

mkdirSync("dist", { recursive: true });
const out = path.join("dist", `flavio-extension-${version}.zip`);
writeFileSync(out, extensionZip(files, origin, { folder: null }));
console.log(`${out} (for ${origin})`);
