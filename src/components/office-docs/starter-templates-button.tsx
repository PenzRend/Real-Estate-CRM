"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useTransition } from "react";
import { addStarterTemplatesAction } from "@/app/(app)/documents/template-actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** Adds the ready-made templates (switched off, to look over first). */
export function StarterTemplatesButton({ variant = "primary" }: { variant?: "primary" | "ghost" }) {
  const [busy, start] = useTransition();
  return (
    <Button
      variant={variant}
      disabled={busy}
      onClick={() =>
        start(async () => {
          const n = await addStarterTemplatesAction();
          toast({ message: n ? `${n} példasablon hozzáadva – kikapcsolva, nézd át őket.` : "A példasablonok már megvannak." });
        })
      }
    >
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Példasablonok
    </Button>
  );
}
