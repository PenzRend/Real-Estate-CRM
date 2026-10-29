"use client";

import { Loader2 } from "lucide-react";
import { useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/**
 * An everyday action that happens at once and can be taken back: no "Are you
 * sure?", but a note with "Visszavonás" for a few seconds.
 */
export function UndoableButton({
  action,
  undo,
  done,
  children,
  variant = "secondary",
  size = "md",
  className,
}: {
  action: () => Promise<unknown>;
  undo: () => Promise<unknown>;
  /** The note after it is done, e.g. "Az ügyfél archiválva." */
  done: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await action();
          toast({ message: done, undo });
        })
      }
    >
      {pending && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

