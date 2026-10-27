"use client";

import { useState } from "react";
import { MediaMosaic } from "@/components/media/media-mosaic";
import { MediaViewer } from "@/components/media/media-viewer";
import type { MediaItem } from "@/lib/db/media";

/** The listing's photos on the client-facing page: the same mosaic and viewer as in the CRM. */
export function SharedGallery({ items }: { items: MediaItem[] }) {
  const [viewing, setViewing] = useState<number | null>(null);
  if (!items.length) return null;
  return (
    <>
      <MediaMosaic items={items} onOpen={setViewing} />
      {viewing != null && items[viewing] && <MediaViewer items={items} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />}
    </>
  );
}
