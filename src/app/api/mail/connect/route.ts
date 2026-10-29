import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMailboxes } from "@/lib/mail/sync";
import { connectPaths } from "@/lib/mail/provider";
import { appOrigin } from "@/lib/origin";

/**
 * "Allow sending" / "Allow calendar" links: on to the connect route of the
 * mailbox they name (`?mailbox=`), else of the one the calendar uses or the
 * default one; Gmail when no Google or Microsoft account is connected (an IMAP
 * mailbox can already send, and has no calendar Flavio can write to).
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const params = request.nextUrl.searchParams;
  const mailboxes = (await listMailboxes(user).catch(() => [])).filter((m) => m.provider !== "imap");
  const target =
    mailboxes.find((m) => m.id === params.get("mailbox")) ??
    (params.get("calendar") === "1" ? mailboxes.find((m) => m.can_calendar) : undefined) ??
    mailboxes[0];
  const url = new URL(connectPaths[target?.provider ?? "gmail"], await appOrigin());
  url.search = params.toString();
  if (target) url.searchParams.set("mailbox", target.id);
  else url.searchParams.delete("mailbox");
  return NextResponse.redirect(url);
}
