import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  clientStatusLabels,
  propertyStatusLabels,
  taskPriorityLabels,
  type ClientStatus,
  type PropertyStatus,
  type TaskPriority,
} from "@/lib/i18n/labels";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "dark";

export const tones: Record<Tone, string> = {
  neutral: "bg-surface-strong text-text",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  dark: "bg-primary text-white",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Small outlined uppercase label above a heading. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
      <span aria-hidden className="text-subtle">
        ›
      </span>
      {children}
    </span>
  );
}

const clientStatusTone: Record<ClientStatus, Tone> = {
  new_lead: "accent",
  contacted: "neutral",
  qualified: "neutral",
  active: "success",
  negotiation: "warning",
  converted: "dark",
  lost: "danger",
  archived: "neutral",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={clientStatusTone[status]}>{clientStatusLabels[status]}</Badge>;
}

export const propertyStatusTone: Record<PropertyStatus, Tone> = {
  draft: "neutral",
  active: "success",
  reserved: "warning",
  under_negotiation: "warning",
  sold: "dark",
  rented: "dark",
  inactive: "neutral",
};

export function PropertyStatusBadge({ status }: { status: PropertyStatus }) {
  return <Badge tone={propertyStatusTone[status]}>{propertyStatusLabels[status]}</Badge>;
}

const priorityTone: Record<TaskPriority, Tone> = {
  low: "neutral",
  normal: "neutral",
  high: "warning",
  urgent: "danger",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={priorityTone[priority]}>{taskPriorityLabels[priority]}</Badge>;
}
