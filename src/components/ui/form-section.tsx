import type { ReactNode } from "react";

/** Two-column form block: title and help on the left, fields on the right. */
export function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-border py-8 first:border-t-0 first:pt-0 md:grid-cols-[1fr_2fr]">
      <div>
        <p className="text-sm text-subtle tabular-nums">/ {number}</p>
        <h2 className="mt-2 text-lg">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
