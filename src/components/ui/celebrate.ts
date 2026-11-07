"use client";

// A short burst of confetti from the middle of the screen: for a deal won.
// Plain DOM and CSS (keyframes in globals.css), no library; skipped when the
// system asks for reduced motion.

const COLORS = ["#3d6ff2", "#1f7a4d", "#f2b33d", "#e05a47", "#0b1619", "#8a5cf6"];

export function celebrate(pieces = 90) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.setAttribute("aria-hidden", "true");
  layer.className = "confetti-layer";
  for (let i = 0; i < pieces; i++) {
    const p = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 160 + Math.random() * 320;
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance - 140}px`);
    p.style.setProperty("--r", `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.setProperty("--d", `${900 + Math.random() * 700}ms`);
    p.style.background = COLORS[i % COLORS.length];
    p.style.width = `${6 + Math.random() * 6}px`;
    p.style.height = `${8 + Math.random() * 8}px`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1900);
}
