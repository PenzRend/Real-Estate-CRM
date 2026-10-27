"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

/** Submit button for a server-action <form>: disabled and dimmed while it runs, so it can't be sent twice. */
export function FormSubmit({ className, children, ...props }: Omit<ComponentProps<"button">, "type">) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={cn("disabled:opacity-50", className)} {...props}>
      {children}
    </button>
  );
}
