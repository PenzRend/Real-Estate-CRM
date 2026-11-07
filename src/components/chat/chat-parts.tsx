"use client";

import { Building, Building2, FileQuestion, Handshake, UserRound } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";
import type { ChatMember, ChatMessage } from "@/lib/chat/data";
import { splitMentions } from "@/lib/chat/text";

const refIcons = { client: UserRound, property: Building2, deal: Handshake } as const;
const refLabels = { client: "Ügyfél", property: "Ingatlan", deal: "Ügylet" } as const;

/** A conversation's picture: the office's building, or the colleague's photo. */
export function ConversationAvatar({ name, url, office = false, size = "md" }: { name: string; url?: string | null; office?: boolean; size?: "sm" | "md" }) {
  if (!office) return <UserAvatar name={name} url={url} size={size} />;
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-accent text-white", size === "sm" ? "size-7" : "size-10")}>
      <Building className={size === "sm" ? "size-3.5" : "size-4"} />
    </span>
  );
}

/** A shared client, listing or deal: a card that opens it. */
export function RefCardView({ refCard, mine }: { refCard: NonNullable<ChatMessage["ref"]>; mine: boolean }) {
  const Icon = refIcons[refCard.kind];
  if ("missing" in refCard) {
    return (
      <span className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-3 py-2 text-xs text-muted">
        <FileQuestion className="size-4" /> A megosztott {refLabels[refCard.kind].toLowerCase()} már nem érhető el.
      </span>
    );
  }
  return (
    <Link
      href={refCard.href}
      className={cn(
        "pop-in flex w-64 max-w-full items-center gap-3 rounded-2xl border p-3 transition-colors",
        mine ? "border-primary/15 bg-background hover:border-primary/40" : "border-border bg-background hover:border-border-strong",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] tracking-wide text-subtle uppercase">{refLabels[refCard.kind]}</span>
        <span className="block truncate text-sm font-medium text-ink">{refCard.title}</span>
        {refCard.detail && <span className="block truncate text-xs text-muted">{refCard.detail}</span>}
      </span>
    </Link>
  );
}

/** Message text with @mentions shown as the colleague's name; a mention of the reader stands out. */
export function MessageText({ body, members, me, mine }: { body: string; members: ChatMember[]; me: string; mine: boolean }) {
  const byUsername = new Map(members.filter((m) => m.username).map((m) => [m.username as string, m]));
  return (
    <>
      {splitMentions(body).map((p, i) => {
        const who = p.mention ? byUsername.get(p.mention) : undefined;
        if (!who) return <span key={i}>{p.text}</span>;
        return (
          <span
            key={i}
            title={`@${who.username}`}
            className={cn(
              "rounded-md px-1 font-medium",
              who.userId === me ? "bg-warning-soft text-warning" : mine ? "bg-white/15 text-white" : "bg-accent-soft text-accent",
            )}
          >
            @{who.name}
          </span>
        );
      })}
    </>
  );
}
