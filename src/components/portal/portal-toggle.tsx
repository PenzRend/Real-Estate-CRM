"use client";

import { Check, Globe } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setPortalExportAction } from "@/app/(app)/properties/[id]/portal-actions";
import { buttonClasses } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { actionFailed } from "@/lib/action-failed";

/** Puts the listing in the workspace's portal export feed (Beállítások → Hirdetési portálok), or takes it out. */
export function PortalToggle({ propertyId, on, listed }: { propertyId: string; on: boolean; listed: boolean }) {
  const [shown, setShown] = useOptimistic(on);
  const [, start] = useTransition();
  return (
    <button
      type="button"
      aria-pressed={shown}
      title={listed ? "A portálokra küldött hirdetések között" : "Csak aktív hirdetés kerül a portálokra"}
      onClick={() =>
        start(async () => {
          const next = !shown;
          setShown(next);
          const r = await setPortalExportAction(propertyId, next).catch(actionFailed);
          const message = !r.ok
            ? "Nem sikerült menteni. Próbáld újra."
            : next
              ? listed
                ? "Bekerült a portálokra küldött hirdetések közé."
                : "Bekerül a portálokra küldött hirdetések közé, amint aktív lesz."
              : "Kikerült a portálokra küldött hirdetések közül.";
          toast({ message });
        })
      }
      className={buttonClasses("secondary")}
    >
      {shown ? <Check /> : <Globe />} {shown ? "Portálokon" : "Portálokra"}
    </button>
  );
}
