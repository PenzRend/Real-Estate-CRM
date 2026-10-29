// The Feladatok tabs, shared by the layout (tab bar) and the page (list).

import type { TaskView } from "@/lib/db/activity";

export const taskViews: { value: TaskView; label: string; empty: string }[] = [
  { value: "today", label: "Mai", empty: "Mára nincs feladat." },
  { value: "overdue", label: "Lejárt", empty: "Nincs lejárt feladat. Szép munka!" },
  { value: "upcoming", label: "Közelgő", empty: "Nincs közelgő vagy határidő nélküli feladat." },
  { value: "completed", label: "Kész", empty: "Még nincs elvégzett feladat." },
];
