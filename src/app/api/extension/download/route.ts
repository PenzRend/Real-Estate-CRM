import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { EXTENSION_FILES, EXTENSION_FOLDER, cleanOrigin, extensionZip } from "@/lib/extension/package";
import { appOrigin } from "@/lib/shares/data";

// The import extension as a zip, set up for this CRM's address. Used until the
// extension is in the Chrome Web Store (then the install card links there).

export async function GET() {
  await getCurrentUser();
  const origin = cleanOrigin(await appOrigin());
  if (!origin) return new NextResponse("Unknown CRM address", { status: 500 });
  const dir = path.join(process.cwd(), "extension");
  const files = Object.fromEntries(await Promise.all(EXTENSION_FILES.map(async (f) => [f, await readFile(path.join(dir, f), "utf8")] as const)));
  const body = extensionZip(files, origin);
  return new NextResponse(body as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${EXTENSION_FOLDER}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
