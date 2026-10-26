import { Building2, CalendarClock, Mail, MapPin, MessageSquareText, Phone, Users, Eye, FileText } from "lucide-react";
import Link from "next/link";
import { PriorityBadge, PropertyStatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatArea, formatDateTime, formatPriceShort } from "@/lib/i18n/format";
import { interactionTypeLabels, propertyTypeLabels, type InteractionType } from "@/lib/i18n/labels";
import type { ActivityItem, PropertyListItem, TaskItem } from "@/lib/types/view-models";
import { TaskToggle } from "./task-toggle";

export const interactionIcons: Record<InteractionType, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: Users,
  viewing: Eye,
  note: FileText,
  other: MessageSquareText,
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLLOW_UP_PREFIX = "follow-up-";

export function TaskRow({ task, overdue = false, done = false }: { task: TaskItem; overdue?: boolean; done?: boolean }) {
  // Client follow-up dates appear among tasks; they are closed by recording the contact.
  const followUpClientId = task.id.startsWith(FOLLOW_UP_PREFIX) ? task.id.slice(FOLLOW_UP_PREFIX.length) : null;
  return (
    <li className="flex items-start gap-3 px-5 py-3.5">
      {UUID.test(task.id) ? (
        <TaskToggle id={task.id} done={done} title={task.title} />
      ) : followUpClientId ? (
        <Link
          href={`/interactions/new?client=${followUpClientId}`}
          className="mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full bg-primary text-white"
          aria-label={`${task.client?.name ?? "Ügyfél"} – hívás rögzítése`}
          title="Hívás rögzítése"
        >
          <Phone className="size-2.5" strokeWidth={2.5} />
        </Link>
      ) : (
        <span aria-hidden className="mt-0.5 size-[18px] shrink-0 rounded-full border-[1.5px] border-border-strong" />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done ? "text-muted line-through" : "text-ink")}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          {task.dueAt && (
            <span className={cn("inline-flex items-center gap-1", overdue && !done && "text-danger")}>
              <CalendarClock className="size-3.5" />
              {formatDateTime(task.dueAt)}
            </span>
          )}
          {task.client && (
            <Link href={`/clients/${task.client.id}`} className="hover:text-ink">
              {task.client.name}
            </Link>
          )}
          {task.property && (
            <Link href={`/properties/${task.property.id}`} className="hover:text-ink">
              {task.property.name}
            </Link>
          )}
        </p>
      </div>
      {task.priority !== "normal" && !done && <PriorityBadge priority={task.priority} />}
    </li>
  );
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = interactionIcons[item.type];
  return (
    <li className="flex gap-3 px-5 py-3.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface text-muted">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-ink">
          {item.client ? (
            <Link href={`/clients/${item.client.id}`} className="font-medium hover:underline">
              {item.client.name}
            </Link>
          ) : (
            <span className="font-medium">{interactionTypeLabels[item.type]}</span>
          )}
          <span className="text-muted"> · {interactionTypeLabels[item.type].toLowerCase()}</span>
        </p>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted">{item.summary}</p>
        <p className="mt-1 text-xs text-subtle">{formatDateTime(item.occurredAt)}</p>
      </div>
    </li>
  );
}

export function PropertyRow({ property }: { property: PropertyListItem }) {
  const location = [property.city, property.district].filter(Boolean).join(", ");
  return (
    <li>
      <Link href={`/properties/${property.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted">
          <Building2 className="size-[18px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{property.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            {location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {location}
              </span>
            )}
            <span>{propertyTypeLabels[property.propertyType]}</span>
            {property.areaSqm != null && <span>{formatArea(property.areaSqm)}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-sm font-medium text-ink tabular-nums">{formatPriceShort(property.price)}</span>
          <PropertyStatusBadge status={property.status} />
        </div>
      </Link>
    </li>
  );
}
