import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchableUrl, portalFetch, readBytesCapped, robotsAllow } from "@/lib/listings/fetch-page";

// Hands a listing photo from a portal to the signed-in agent's browser, so the
// import can resize it and strip its metadata there like any upload. Portal
// hosts only (no open proxy), robots.txt respected, images only, size capped.

const MAX_BYTES = 15 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function GET(request: NextRequest) {
  await getCurrentUser();
  const url = fetchableUrl(request.nextUrl.searchParams.get("url") ?? "");
  if (!url) return new NextResponse("Not a portal image", { status: 400 });
  // Photo servers can opt out like pages do; then only the extension can bring the photos.
  if (!(await robotsAllow(url))) return new NextResponse("Not allowed by robots.txt", { status: 403 });
  try {
    const res = await portalFetch(url, "image/jpeg,image/png,image/webp");
    const type = res?.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    const length = Number(res?.headers.get("content-length") ?? 0);
    if (!res?.ok || !TYPES.includes(type) || length > MAX_BYTES) return new NextResponse("Image not available", { status: 502 });
    // content-length can be missing (chunked), so the cap is enforced while reading.
    const body = await readBytesCapped(res, MAX_BYTES);
    if (!body) return new NextResponse("Image too large", { status: 502 });
    return new NextResponse(new Uint8Array(body), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=600" } });
  } catch {
    return new NextResponse("Image not available", { status: 502 });
  }
}
