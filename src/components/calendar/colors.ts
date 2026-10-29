// Colours of calendar sources: the event's left edge and its dot in the legend.

export const eventColors: Record<string, { bar: string; dot: string }> = {
  accent: { bar: "border-l-accent bg-accent-soft", dot: "bg-accent" },
  amber: { bar: "border-l-amber-500 bg-amber-50", dot: "bg-amber-500" },
  sky: { bar: "border-l-sky-500 bg-sky-50", dot: "bg-sky-500" },
  violet: { bar: "border-l-violet-500 bg-violet-50", dot: "bg-violet-500" },
  rose: { bar: "border-l-rose-500 bg-rose-50", dot: "bg-rose-500" },
  emerald: { bar: "border-l-emerald-500 bg-emerald-50", dot: "bg-emerald-500" },
  slate: { bar: "border-l-slate-500 bg-slate-100", dot: "bg-slate-500" },
};

export const colorNames: Record<string, string> = { sky: "Kék", violet: "Lila", amber: "Sárga", rose: "Rózsaszín", emerald: "Zöld", slate: "Szürke" };
