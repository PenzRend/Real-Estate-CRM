import { BarChart3, Building2, CalendarDays, CheckSquare, FolderOpen, Handshake, Inbox, LayoutGrid, MessagesSquare, Users, type LucideIcon } from "lucide-react";

// Few doors, so a new agent finds their way on day one. An item with
// sub-pages opens them as a branch below itself while you are in it
// (Dokumentumok: files, contracts, the document creator). Settings live
// behind the profile at the bottom; the assistant is the round button and
// "Mondd Flaviónak".

export type NavChild = { href: string; label: string; /** Only this exact address, not the pages below it. */ exact?: boolean };
export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Other screens that light this item up. */
  also?: string[];
  children?: NavChild[];
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Áttekintés", icon: LayoutGrid },
  { href: "/clients", label: "Ügyfelek", icon: Users },
  { href: "/properties", label: "Ingatlanok", icon: Building2 },
  { href: "/deals", label: "Ügyletek", icon: Handshake },
  { href: "/tasks", label: "Feladatok", icon: CheckSquare },
  { href: "/calendar", label: "Naptár", icon: CalendarDays },
  {
    href: "/inbox",
    label: "Levelek",
    icon: Inbox,
    children: [
      { href: "/inbox", label: "Beérkezett", exact: true },
      { href: "/inbox/automation", label: "Automatikus levelek" },
    ],
  },
  {
    href: "/documents",
    label: "Dokumentumok",
    icon: FolderOpen,
    also: ["/contracts"],
    children: [
      { href: "/documents", label: "Fájlok", exact: true },
      { href: "/contracts", label: "Szerződések" },
      { href: "/documents/templates", label: "Dokumentumkészítő" },
    ],
  },
];

/** Shown only when the office has more than one member. */
export const teamNavItems: NavItem[] = [
  { href: "/messages", label: "Üzenetek", icon: MessagesSquare },
  { href: "/office", label: "Iroda", icon: BarChart3 },
];
