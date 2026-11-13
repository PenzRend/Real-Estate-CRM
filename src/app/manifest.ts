import type { MetadataRoute } from "next";

/** Flavio as an installed app (home screen on a phone, its own window on a computer), which can receive notifications. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flavio",
    short_name: "Flavio",
    description: "AI CRM ingatlanosoknak: ügyfelek, ingatlanok, levelek és ügyletek egy helyen.",
    lang: "hu",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/app-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
