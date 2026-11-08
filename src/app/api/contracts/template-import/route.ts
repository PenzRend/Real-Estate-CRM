import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { MAX_IMPORT_BYTES } from "@/lib/contracts/import-text";
import { recreateFromFile } from "@/lib/contracts/templates";

/**
 * The office's own Word or PDF contract → a template draft for the editor.
 * A route rather than a server action: contracts can be larger than an
 * action's request limit. The file itself is not stored; only the text the
 * agency approves in the editor is saved.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "A fájl nem érkezett meg." }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ ok: false, error: "A fájl üres." }, { status: 400 });
  if (file.size > MAX_IMPORT_BYTES) return NextResponse.json({ ok: false, error: "A fájl legfeljebb 15 MB lehet." }, { status: 413 });
  return NextResponse.json(await recreateFromFile(user, kind, file));
}
