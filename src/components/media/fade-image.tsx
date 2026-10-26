"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * An image that appears with a soft fade once it has loaded, over a quiet
 * placeholder, instead of painting in line by line. Images already in the
 * browser's cache show at once.
 */
export function FadeImage({ src, alt = "", className, eager = false }: { src: string; alt?: string; className?: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // Signed links to private, already resized files: no image optimiser needed.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(el) => {
        if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
      }}
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={cn("transition-[opacity,transform] duration-500 ease-out", loaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0", className)}
    />
  );
}
