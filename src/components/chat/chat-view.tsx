"use client";

import { ArrowLeft, Building, Loader2, SendHorizontal, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { deleteMessageAction, loadMessagesAction, markReadAction, sendMessageAction } from "@/app/(app)/messages/actions";
import { cn } from "@/lib/cn";
import type { ChatMessage, Conversation } from "@/lib/chat/data";
import { createBrowserSupabase } from "@/lib/supabase/client";

const time = new Intl.DateTimeFormat("hu-HU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Budapest" });
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" });
const dayLong = new Intl.DateTimeFormat("hu-HU", { month: "long", day: "numeric", weekday: "long", timeZone: "Europe/Budapest" });
const shortDate = new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", timeZone: "Europe/Budapest" });

function dayLabel(iso: string) {
  const d = dayKey.format(new Date(iso));
  const today = dayKey.format(new Date());
  const yesterday = dayKey.format(new Date(Date.now() - 86_400_000));
  return d === today ? "Ma" : d === yesterday ? "Tegnap" : dayLong.format(new Date(iso));
}

function when(iso: string) {
  return dayKey.format(new Date(iso)) === dayKey.format(new Date()) ? time.format(new Date(iso)) : shortDate.format(new Date(iso));
}

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

function Avatar({ name, office = false, size = "md" }: { name: string; office?: boolean; size?: "sm" | "md" }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full font-medium", size === "sm" ? "size-7 text-[11px]" : "size-10 text-xs", office ? "bg-accent text-white" : "bg-surface-strong text-ink")}>
      {office ? <Building className={size === "sm" ? "size-3.5" : "size-4"} /> : initials(name)}
    </span>
  );
}

/** The office chat: conversations on the left, the open one on the right; new messages arrive live. */
export function ChatView({
  me,
  peer,
  conversations,
  members,
  initial,
}: {
  me: string;
  peer: string;
  conversations: Conversation[];
  members: { userId: string; name: string }[];
  initial: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const names = new Map(members.map((m) => [m.userId, m.name]));
  // "list" (a phone showing the conversations): on a wide screen the office channel is open beside it.
  const open = conversations.find((c) => c.peer === peer) ?? conversations[0];
  const current = open.peer;
  const alone = conversations.length === 1;

  // A refreshed conversation from the server replaces the list (adjusting state during render).
  const [from, setFrom] = useState(initial);
  if (from !== initial) {
    setFrom(initial);
    setMessages(initial);
  }

  // Stay at the newest message.
  useLayoutEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: messages === initial ? "instant" : "smooth" });
  }, [messages, initial]);

  // Live: a message for this conversation is appended; one elsewhere refreshes the unread counts.
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`chat-${me}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as { id: string; sender_id: string; recipient_id: string | null; body: string; created_at: string };
        const ofThis = current === "office" ? m.recipient_id == null : (m.sender_id === current && m.recipient_id === me) || (m.sender_id === me && m.recipient_id === current);
        if (ofThis) {
          setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, { id: m.id, senderId: m.sender_id, recipientId: m.recipient_id, body: m.body, createdAt: m.created_at }]));
          if (m.sender_id !== me) void markReadAction(current);
        } else if (m.sender_id !== me) {
          router.refresh();
        }
      })
      .subscribe((status) => {
        // After a reconnect, catch up on anything missed.
        if (status === "SUBSCRIBED") void loadMessagesAction(current).then((ms) => setMessages((cur) => (ms.length >= cur.length ? ms : cur)));
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me, current, router]);

  function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setDraft("");
    const temp: ChatMessage = { id: `temp-${Date.now()}`, senderId: me, recipientId: current === "office" ? null : current, body: text, createdAt: new Date().toISOString() };
    setMessages((ms) => [...ms, temp]);
    start(async () => {
      const r = await sendMessageAction(current, text).catch(() => ({ ok: false as const, error: "Az üzenet nem ment el. Próbáld újra." }));
      if (r.ok) {
        setMessages((ms) => (ms.some((x) => x.id === r.message.id) ? ms.filter((x) => x.id !== temp.id) : ms.map((x) => (x.id === temp.id ? r.message : x))));
        router.refresh(); // the conversation list's last message
      } else {
        setMessages((ms) => ms.filter((x) => x.id !== temp.id));
        setDraft(text);
        setError(r.error);
      }
    });
    box.current?.focus();
  }

  function remove(id: string) {
    setMessages((ms) => ms.filter((x) => x.id !== id));
    void deleteMessageAction(id).then(() => router.refresh());
  }

  return (
    <div className="grid h-[calc(100dvh-11rem)] min-h-[28rem] grid-cols-1 overflow-hidden rounded-3xl border border-border bg-background md:grid-cols-[18rem_1fr]">
      {/* Conversations: on a phone only when none is open. */}
      <aside className={cn("min-h-0 flex-col border-border md:flex md:border-r", peer === "list" ? "flex" : "hidden")}>
        <p className="px-5 pt-5 pb-2 text-xs font-medium tracking-wide text-subtle uppercase">Beszélgetések</p>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {conversations.map((c) => {
            const active = c.peer === open.peer;
            return (
              <li key={c.peer}>
                <Link
                  href={`/messages?with=${c.peer}`}
                  scroll={false}
                  className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", active ? "bg-surface-strong" : "hover:bg-surface")}
                >
                  <Avatar name={c.name} office={c.peer === "office"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm text-ink", c.unread ? "font-semibold" : "font-medium")}>{c.peer === "office" ? `${c.name} – mindenki` : c.name}</span>
                      {c.last && <span className="shrink-0 text-[11px] text-subtle">{when(c.last.at)}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-xs", c.unread ? "text-ink" : "text-muted")}>
                        {c.last ? `${c.last.mine ? "Te: " : ""}${c.last.body}` : c.peer === "office" ? "Az egész iroda látja" : "Még nincs üzenet"}
                      </span>
                      {c.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-medium text-white">{c.unread}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        {alone && (
          <Link href="/settings" className="m-3 flex items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm text-accent">
            <UserPlus className="size-4 shrink-0" /> Hívd meg a kollégáidat a Beállításokban, és itt tudtok beszélgetni.
          </Link>
        )}
      </aside>

      <section className={cn("min-h-0 flex-col", peer === "list" ? "hidden md:flex" : "flex")}>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
          <Link href="/messages" className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface md:hidden" aria-label="Vissza a beszélgetésekhez">
            <ArrowLeft className="size-4" />
          </Link>
          <Avatar name={open.name} office={open.peer === "office"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{open.peer === "office" ? `${open.name} – mindenki` : open.name}</p>
            <p className="text-xs text-muted">{open.peer === "office" ? `${members.length} tag látja` : "Csak ti ketten látjátok"}</p>
          </div>
        </header>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <p className="max-w-xs text-sm text-muted">
                {open.peer === "office" ? "Írj az irodának: egy gyors kérdés, egy új megbízás híre vagy egy gratuláció." : `Írj ${open.name} részére – csak ti ketten látjátok.`}
              </p>
            </div>
          ) : (
            <ol className="flex flex-col gap-1">
              {messages.map((m, i) => {
                const mine = m.senderId === me;
                const prev = messages[i - 1];
                const showDay = !prev || dayKey.format(new Date(m.createdAt)) !== dayKey.format(new Date(prev.createdAt));
                const first = showDay || !prev || prev.senderId !== m.senderId || Date.parse(m.createdAt) - Date.parse(prev.createdAt) > 5 * 60_000;
                const pending = m.id.startsWith("temp-");
                return (
                  <li key={m.id} className="flex flex-col">
                    {showDay && <p className="my-3 self-center rounded-full bg-surface px-3 py-1 text-[11px] text-muted">{dayLabel(m.createdAt)}</p>}
                    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "", first ? "mt-2" : "")}>
                      {!mine && (first ? <Avatar name={names.get(m.senderId) ?? "?"} size="sm" /> : <span className="w-7 shrink-0" />)}
                      <div className={cn("flex max-w-[78%] flex-col", mine ? "items-end" : "items-start")}>
                        {first && !mine && open.peer === "office" && <span className="mb-0.5 px-1 text-[11px] text-muted">{names.get(m.senderId) ?? "Volt munkatárs"}</span>}
                        <p
                          className={cn(
                            "pop-in rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap [--pop-from:6px]",
                            mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink",
                            pending && "opacity-60",
                          )}
                          title={time.format(new Date(m.createdAt))}
                        >
                          {m.body}
                        </p>
                      </div>
                      <span className="mb-1 text-[10px] text-subtle opacity-0 transition-opacity group-hover:opacity-100">{time.format(new Date(m.createdAt))}</span>
                      {mine && !pending && (
                        <button
                          type="button"
                          onClick={() => remove(m.id)}
                          className="mb-1 grid size-6 place-items-center rounded-full text-subtle opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                          aria-label="Üzenet törlése"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-end gap-2 border-t border-border p-3 sm:p-4"
        >
          <textarea
            ref={box}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder={open.peer === "office" ? "Üzenet az irodának…" : `Üzenet ${open.name} részére…`}
            aria-label="Üzenet"
            className="max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm text-ink [field-sizing:content] focus:border-ink focus:bg-background focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-white hover:bg-primary-hover disabled:opacity-40"
            aria-label="Küldés"
          >
            {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
          </button>
        </form>
        {error && (
          <p role="alert" className="px-4 pb-3 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
