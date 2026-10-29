import { ImageResponse } from "next/og";

/**
 * Flavio's app icon (the house mark on the brand's near-black), as a PNG of
 * any size: the home-screen icon and the notification icon. `padded` leaves
 * the safe zone Android needs for "maskable" icons.
 */
export function brandIcon(size: number, padded = false) {
  const mark = Math.round(size * (padded ? 0.42 : 0.56));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1b1b1b", borderRadius: padded ? 0 : Math.round(size * 0.22) }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2">
          <path d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 10v9h10v-9" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
