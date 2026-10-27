"use client";

import { useId, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

function SubmitButton({ label, variant }: { label: string; variant: "primary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Folyamatban…" : label}
    </Button>
  );
}

/** A trigger button that opens a confirmation dialog before running a server action. */
export function ConfirmAction({
  action,
  trigger,
  title,
  description,
  confirmLabel,
  tone = "primary",
  size = "md",
}: {
  action: () => Promise<void>;
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  size?: "xs" | "sm" | "md";
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <Button variant="secondary" size={size} onClick={() => dialog.current?.showModal()}>
        {trigger}
      </Button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border border-border bg-background p-6 text-text shadow-float backdrop:bg-ink/30"
        aria-labelledby={titleId}
      >
        <h2 id={titleId} className="text-lg">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        <form action={action} className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => dialog.current?.close()}>
            Mégse
          </Button>
          <SubmitButton label={confirmLabel} variant={tone} />
        </form>
      </dialog>
    </>
  );
}
