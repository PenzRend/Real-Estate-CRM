"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/i18n/format";

// Charts for the admin's Pénzügyek tab, drawn as plain SVG. The current
// period is the app's blue; the period before is a dashed gray baseline
// (named in the legend and the tooltip, so it never rests on color alone).

const CURRENT = "var(--accent)";
const PREVIOUS = "#8b9099";

/** A card's small trend line: the current period only, no axes (the number above it says the value). */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const d = values.map((v, i) => `${values.length < 2 ? 50 : (i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} aria-hidden>
      <polyline points={d} fill="none" stroke={CURRENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** "1,2 M" / "350 E" / "900": the axis's short money. */
const axisMoney = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0).replace(".", ",")} M` : v >= 1000 ? `${Math.round(v / 1000)} E` : String(Math.round(v));

/** A round top for the axis: 1, 2, 2.5 or 5 times a power of ten. */
function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

export type TrendPoint = { label: string; value: number; prevLabel: string; prev: number };

/**
 * The big chart: this period against the one before, a crosshair and a
 * tooltip on hover (and with the arrow keys once focused).
 */
export function TrendChart({ points, currentLabel, previousLabel }: { points: TrendPoint[]; currentLabel: string; previousLabel: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [at, setAt] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = 240;
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const w = width - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const top = niceMax(Math.max(...points.map((p) => Math.max(p.value, p.prev)), 0));
  const x = (i: number) => pad.l + (points.length < 2 ? w / 2 : (i / (points.length - 1)) * w);
  const y = (v: number) => pad.t + h - (v / top) * h;
  const path = (key: "value" | "prev") => points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join("");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * top);
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(w / 90))));

  function pick(clientX: number) {
    const r = box.current?.getBoundingClientRect();
    if (!r || !points.length) return;
    const i = Math.round(((clientX - r.left - pad.l) / w) * (points.length - 1));
    setAt(Math.max(0, Math.min(points.length - 1, i)));
  }

  const p = at != null ? points[at] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke={CURRENT} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke={PREVIOUS} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          {previousLabel}
        </span>
      </div>
      <div
        ref={box}
        className="relative outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-xl"
        tabIndex={0}
        role="img"
        aria-label={`${currentLabel} és ${previousLabel}, ${points.length} pont. A nyilakkal lépkedhetsz.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setAt((i) => Math.min(points.length - 1, (i ?? -1) + 1));
          else if (e.key === "ArrowLeft") setAt((i) => Math.max(0, (i ?? points.length) - 1));
          else if (e.key === "Escape") setAt(null);
        }}
        onBlur={() => setAt(null)}
      >
        <svg width={width} height={H} className="block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--muted)] text-[11px] tabular-nums">
                {axisMoney(t)}
              </text>
            </g>
          ))}
          {points.map((pt, i) =>
            i % every === 0 || i === points.length - 1 ? (
              <text key={pt.label} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-[var(--muted)] text-[11px]">
                {pt.label}
              </text>
            ) : null,
          )}
          <path d={path("prev")} fill="none" stroke={PREVIOUS} strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" />
          <path d={path("value")} fill="none" stroke={CURRENT} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {p && at != null && (
            <g>
              <line x1={x(at)} x2={x(at)} y1={pad.t} y2={pad.t + h} stroke="var(--border-strong)" strokeWidth={1} />
              <circle cx={x(at)} cy={y(p.prev)} r={4} fill={PREVIOUS} stroke="var(--background)" strokeWidth={2} />
              <circle cx={x(at)} cy={y(p.value)} r={4} fill={CURRENT} stroke="var(--background)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {p && at != null && (
          <div
            role="status"
            className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-xl border border-border bg-background px-3 py-2 text-xs shadow-float"
            style={x(at) > width / 2 ? { right: width - x(at) + 12 } : { left: x(at) + 12 }}
          >
            <p className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <svg width="12" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="12" y2="2" stroke={CURRENT} strokeWidth="2" />
                </svg>
                {p.label}
              </span>
              <span className="font-medium text-ink tabular-nums">{formatPrice(p.value)}</span>
            </p>
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted">
                <svg width="12" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="12" y2="2" stroke={PREVIOUS} strokeWidth="2" strokeDasharray="3 2" />
                </svg>
                {p.prevLabel}
              </span>
              <span className="text-muted tabular-nums">{formatPrice(p.prev)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
