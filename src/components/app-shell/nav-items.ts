import {
  Building2,
  CheckSquare,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";

export const navItems: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "Áttekintés", icon: LayoutGrid },
  { href: "/clients", label: "Ügyfelek", icon: Users },
  { href: "/properties", label: "Ingatlanok", icon: Building2 },
  { href: "/tasks", label: "Feladatok", icon: CheckSquare },
  { href: "/assistant", label: "AI-asszisztens", icon: Sparkles },
  { href: "/settings", label: "Beállítások", icon: Settings },
];
