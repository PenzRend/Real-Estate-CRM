import { BarChart3, Building2, CheckSquare, FolderOpen, Handshake, Inbox, LayoutGrid, MessagesSquare, Users, type LucideIcon } from "lucide-react";

// Few doors, so a new agent finds their way on day one. Related screens share
// one item (and switch between each other with tabs at the top): Teendők is
// tasks and the calendar, Dokumentumok is files, contracts and templates.
// Settings live behind the profile at the bottom; the assistant is the round
// button and "Mondd Flaviónak".

export type NavItem = { href: string; label: string; icon: LucideIcon; /** Other screens that light this item up. */ also?: string[] };

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Áttekintés", icon: LayoutGrid },
  { href: "/clients", label: "Ügyfelek", icon: Users },
  { href: "/properties", label: "Ingatlanok", icon: Building2 },
  { href: "/deals", label: "Ügyletek", icon: Handshake },
  { href: "/tasks", label: "Teendők", icon: CheckSquare, also: ["/calendar"] },
  { href: "/inbox", label: "Levelek", icon: Inbox },
  { href: "/documents", label: "Dokumentumok", icon: FolderOpen, also: ["/contracts"] },
];

/** Shown only when the office has more than one member. */
export const teamNavItems: NavItem[] = [
  { href: "/messages", label: "Üzenetek", icon: MessagesSquare },
  { href: "/office", label: "Iroda", icon: BarChart3 },
];
