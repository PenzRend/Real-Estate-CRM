import { ImageResponse } from "next/og";

// The picture shown when a Flavio link is shared (Facebook, LinkedIn, Messenger, Viber…).
export const alt = "Flavio – AI-alapú CRM magyar ingatlanosoknak";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1b1b1b", color: "#ffffff", padding: 72 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#1b1b1b" strokeWidth="2.4">
              <path d="M4 11.5 12 5l8 6.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 10v9h10v-9" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 44, letterSpacing: -2 }}>flavio</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 30, color: "rgba(255,255,255,0.6)" }}>AI-alapú CRM magyar ingatlanosoknak</div>
          <div style={{ fontSize: 76, lineHeight: 1.05, letterSpacing: -3, maxWidth: 980 }}>Te tárgyalsz. Az adminisztráció megcsinálja magát.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, color: "rgba(255,255,255,0.7)" }}>
          <span>Diktálásból ügyféladat</span>
          <span>·</span>
          <span>Párosítás indoklással</span>
          <span>·</span>
          <span>Gmail és Outlook</span>
        </div>
      </div>
    ),
    size,
  );
}
