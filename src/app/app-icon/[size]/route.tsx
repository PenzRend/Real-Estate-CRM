import { brandIcon } from "@/lib/brand-icon";

const SIZES: Record<string, { size: number; padded: boolean }> = {
  "192": { size: 192, padded: false },
  "512": { size: 512, padded: false },
  "maskable-512": { size: 512, padded: true },
  "badge-96": { size: 96, padded: false },
};

/** The installed app's icons (see app/manifest.ts) and the notification icon. */
export async function GET(_request: Request, { params }: RouteContext<"/app-icon/[size]">) {
  const spec = SIZES[(await params).size];
  if (!spec) return new Response("Not found", { status: 404 });
  const image = brandIcon(spec.size, spec.padded);
  image.headers.set("Cache-Control", "public, max-age=604800, immutable");
  return image;
}

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}
