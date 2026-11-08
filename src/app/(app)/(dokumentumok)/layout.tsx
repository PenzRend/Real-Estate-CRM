import type { ReactNode } from "react";
import { SectionBar } from "@/components/ui/section-switch";

/** The switch between this menu item's screens stays put while only the page below changes. */
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <SectionBar group="dokumentumok" />
      {children}
    </>
  );
}
