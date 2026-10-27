import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMailbox } from "@/lib/mail/sync";
import { connectPaths } from "@/lib/mail/provider";
import { appOrigin } from "@/lib/origin";

/**
 * "Allow sending" / "Allow calendar" links: on to the connect route of the
 * provider the agent uses (Gmail when nothing is connected yet), keeping the query.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const mailbox = await getMailbox(user).catch(() => null);
  const url = new URL(connectPaths[mailbox?.provider ?? "gmail"], await appOrigin());
  url.search = request.nextUrl.search;
  return NextResponse.redirect(url);
}
