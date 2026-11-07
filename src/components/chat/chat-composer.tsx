"use client";

import { Building2, Handshake, Loader2, Paperclip, Search, SendHorizontal, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { searchShareableAction } from "@/app/(app)/messages/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";
import type { ChatMember } from "@/lib/chat/data";
import { mentionAtCursor } from "@/lib/chat/text";

export type Attachment = { kind: "client" | "property" | "deal"; id: string; title: string; detail: string | null };
const icons = { client: UserRound, property: Building2, deal: Handshake } as const;

/**
 * The message box: Enter sends, Shift+Enter is a new line. Typing "@" offers
 * colleagues to mention; the paperclip attaches a client, listing or deal.
 */
export function ChatComposer({
  members,
  me,
  placeholder,
  sending,
  onSend,
}: {
  members: ChatMember[];
  me: string;
  placeholder: string;
  sending: boolean;
  onSend: (text: string, attachment: Attachment | null) => boolean;
}) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null);
  const [active, setActive] = useState(0);
  const [picking, setPicking] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);

  const suggestions = mention
    ? members.filter((m) => m.userId !== me && m.username && (`${m.username} ${m.name}`.toLowerCase().includes(mention.query))).slice(0, 6)
    : [];

  function insertMention(m: ChatMember) {
    if (!mention || !m.username) return;
    const cursor = box.current?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mention.start)}@${m.username} ${draft.slice(cursor)}`;
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      const at = mention.start + m.username!.length + 2;
      box.current?.focus();
      box.current?.setSelectionRange(at, at);
    });
  }

  function submit() {
    if (!draft.trim() && !attachment) return;
    if (onSend(draft, attachment)) {
      setDraft("");
      setAttachment(null);
    }
    box.current?.focus();
  }

  return (
    <div className="relative border-t border-border p-3 sm:p-4">
      {suggestions.length > 0 && (
        <ul className="pop-in absolute bottom-full left-3 z-20 mb-2 w-72 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-float [--pop-from:6px]" role="listbox" aria-label="Kollégák">
          {suggestions.map((m, i) => (
            <li key={m.userId}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                className={cn("flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left", i === active ? "bg-surface" : "hover:bg-surface")}
              >
                <UserAvatar name={m.name} url={m.avatarUrl} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{m.name}</span>
                  <span className="block truncate text-xs text-muted">@{m.username}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picking && <RecordPicker onPick={(a) => (setAttachment(a), setPicking(false), box.current?.focus())} onClose={() => setPicking(false)} />}

      {attachment && (
        <div className="reveal mb-2 flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-sm">
          {(() => {
            const Icon = icons[attachment.kind];
            return <Icon className="size-4 shrink-0 text-accent" />;
          })()}
          <span className="min-w-0 flex-1 truncate text-ink">{attachment.title}</span>
          <button type="button" onClick={() => setAttachment(null)} className="grid size-6 place-items-center rounded-full text-muted hover:bg-background hover:text-ink" aria-label="Csatolás elvetése">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <button
          type="button"
          onClick={() => setPicking((p) => !p)}
          aria-expanded={picking}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
          aria-label="Ügyfél, ingatlan vagy ügylet csatolása"
          title="Ügyfél, ingatlan vagy ügylet csatolása"
        >
          <Paperclip className="size-4" />
        </button>
        <textarea
          ref={box}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setMention(mentionAtCursor(e.target.value, e.target.selectionStart));
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (suggestions.length) {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (a + (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) % suggestions.length);
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                insertMention(suggestions[active]);
                return;
              }
              if (e.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder={placeholder}
          aria-label="Üzenet"
          className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink [field-sizing:content] focus:border-ink focus:bg-background focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim() && !attachment}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
          aria-label="Küldés"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
        </button>
      </form>
    </div>
  );
}

/** Search clients, listings and deals to attach. */
function RecordPicker({ onPick, onClose }: { onPick: (a: Attachment) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      setLoading(true);
      void searchShareableAction(q)
        .then((r) => live && setHits(r))
        .finally(() => live && setLoading(false));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query]);

  const shown = query.trim().length < 2 ? [] : hits;
  return (
    <div className="pop-in absolute bottom-full left-3 z-20 mb-2 w-[min(24rem,calc(100%-1.5rem))] rounded-2xl border border-border bg-background p-2 shadow-float [--pop-from:6px]">
      <label className="relative block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Ügyfél, ingatlan vagy ügylet keresése"
          aria-label="Csatolandó rekord keresése"
          className="h-10 w-full rounded-xl border border-border pr-9 pl-9 text-sm focus:border-ink focus:outline-none"
        />
        {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-subtle" />}
      </label>
      <ul className="mt-1 max-h-64 overflow-y-auto">
        {shown.map((h) => {
          const Icon = icons[h.kind];
          return (
            <li key={`${h.kind}-${h.id}`}>
              <button type="button" onClick={() => onPick(h)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface">
                <Icon className="size-4 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{h.title}</span>
                  {h.detail && <span className="block truncate text-xs text-muted">{h.detail}</span>}
                </span>
              </button>
            </li>
          );
        })}
        {query.trim().length >= 2 && !loading && !shown.length && <li className="px-3 py-3 text-sm text-muted">Nincs találat.</li>}
        {query.trim().length < 2 && <li className="px-3 py-3 text-xs text-muted">Írj be legalább két betűt.</li>}
      </ul>
    </div>
  );
}
