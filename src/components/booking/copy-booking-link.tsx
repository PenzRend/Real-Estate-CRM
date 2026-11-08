"use client";

import { CalendarPlus } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** In a listing's "…" menu: the agent's booking link with this listing already chosen. */
export function CopyBookingLink({ token, propertyId }: { token: string; propertyId: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}/b/${token}?p=${propertyId}`;
        try {
          await navigator.clipboard.writeText(url);
          toast({ message: "Foglalási link másolva – küldd el az érdeklődőnek." });
        } catch {
          window.prompt("Másold ki a linket:", url);
        }
      }}
      className={buttonClasses("secondary", "md", "w-full justify-start border-transparent shadow-none")}
    >
      <CalendarPlus /> Foglalási link másolása
    </button>
  );
}
