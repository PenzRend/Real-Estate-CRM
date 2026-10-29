// The Levelek tabs, shared by the layout (tab bar) and the page (list).

import type { EmailStatus } from "@/lib/db/mail";

export type InboxView = EmailStatus | "all";

export const inboxViews: { value: InboxView; label: string; empty: string }[] = [
  { value: "new", label: "Feldolgozandó", empty: "Nincs feldolgozandó levél." },
  { value: "processed", label: "Feldolgozott", empty: "Még nincs feldolgozott levél." },
  { value: "ignored", label: "Elrejtett", empty: "Nincs elrejtett levél." },
  { value: "all", label: "Összes levél", empty: "Nincs levél." },
];
