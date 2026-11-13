"use client";

import { ArrowLeft, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { deleteMessageAction, loadMessagesAction, markReadAction, sendMessageAction, shareToChatAction } from "@/app/(app)/messages/actions";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/cn";
import type { ChatMember, ChatMessage, Conversation } from "@/lib/chat/data";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { ChatComposer, type Attachment } from "./chat-composer";
import { ConversationAvatar, MessageText, RefCardView } from "./chat-parts";

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

/** The office chat: conversations on the left, the open one on the right; new messages arrive live. */
export function ChatView({
  me,
  peer,
  conversations,
  members,
  initial,
}: {
  me: string;
  /** The open conversation, or "list" for a phone showing the conversations. */
  peer: string;
  conversations: Conversation[];
  members: ChatMember[];
  initial: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [sending, start] = useTransition();
  const list = useRef<HTMLDivElement>(null);
  const people = new Map(members.map((m) => [m.userId, m]));
  // On a wide screen the office channel is open beside the list.
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
    const catchUp = () => void loadMessagesAction(current).then(setMessages);
    const channel = supabase
      .channel(`chat-${me}-${crypto.randomUUID()}`) // unique: the previous one may still be closing
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const m = payload.new as { id: string; sender_id: string; recipient_id: string | null; body: string; created_at: string; ref_kind: string | null };
        const ofThis = current === "office" ? m.recipient_id == null : (m.sender_id === current && m.recipient_id === me) || (m.sender_id === me && m.recipient_id === current);
        if (!ofThis) {
          if (m.sender_id !== me) router.refresh();
          return;
        }
        if (m.ref_kind) catchUp(); // the shared record's card comes from the server
        else setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, { id: m.id, senderId: m.sender_id, recipientId: m.recipient_id, body: m.body, createdAt: m.created_at, ref: null }]));
        if (m.sender_id !== me) void markReadAction(current);
      })
      .subscribe((status) => {
        // After a reconnect, catch up on anything missed.
        if (status === "SUBSCRIBED") catchUp();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me, current, router]);

  function send(text: string, attachment: Attachment | null) {
    const body = text.trim();
    if ((!body && !attachment) || sending) return false;
    setError(null);
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      senderId: me,
      recipientId: current === "office" ? null : current,
      body,
      createdAt: new Date().toISOString(),
      ref: attachment ? { kind: attachment.kind, id: attachment.id, title: attachment.title, detail: attachment.detail, href: "#" } : null,
    };
    setMessages((ms) => [...ms, temp]);
    start(async () => {
      const failed = { ok: false as const, error: "Az üzenet nem ment el. Próbáld újra." };
      const r = await (attachment ? shareToChatAction(current, attachment, body) : sendMessageAction(current, body)).catch(() => failed);
      if (r.ok) {
        setMessages((ms) => (ms.some((x) => x.id === r.message.id) ? ms.filter((x) => x.id !== temp.id) : ms.map((x) => (x.id === temp.id ? r.message : x))));
        router.refresh(); // the conversation list's last message
      } else {
        setMessages((ms) => ms.filter((x) => x.id !== temp.id));
        setError(r.error);
      }
    });
    return true;
  }

  function remove(id: string) {
    setMessages((ms) => ms.filter((x) => x.id !== id));
    void deleteMessageAction(id).then(() => router.refresh());
  }

  const title = (c: Conversation) => (c.peer === "office" ? `${c.name} – mindenki` : c.name);

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
                <Link href={`/messages?with=${c.peer}`} scroll={false} className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", active ? "bg-surface-strong" : "hover:bg-surface")}>
                  <ConversationAvatar name={c.name} url={people.get(c.peer)?.avatarUrl} office={c.peer === "office"} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm text-ink", c.unread ? "font-semibold" : "font-medium")}>{title(c)}</span>
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
          <ConversationAvatar name={open.name} url={people.get(open.peer)?.avatarUrl} office={open.peer === "office"} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{title(open)}</p>
            <p className="text-xs text-muted">
              {open.peer === "office" ? `${members.length} tag látja · @ és egy név: megemlítheted a kollégát` : "Csak ti ketten látjátok"}
            </p>
          </div>
        </header>

        <div ref={list} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <p className="max-w-xs text-sm text-muted">
                {open.peer === "office"
                  ? "Írj az irodának: egy gyors kérdés, egy új megbízás híre vagy egy gratuláció. A gemkapoccsal ügyfelet, ingatlant vagy ügyletet is küldhetsz."
                  : `Írj ${open.name} részére – csak ti ketten látjátok. A gemkapoccsal ügyfelet, ingatlant vagy ügyletet is átküldhetsz.`}
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
                const sender = people.get(m.senderId);
                return (
                  <li key={m.id} className="flex flex-col">
                    {showDay && <p className="my-3 self-center rounded-full bg-surface px-3 py-1 text-[11px] text-muted">{dayLabel(m.createdAt)}</p>}
                    <div className={cn("group flex items-end gap-2", mine ? "flex-row-reverse" : "", first ? "mt-2" : "")}>
                      {!mine && (first ? <UserAvatar name={sender?.name ?? "?"} url={sender?.avatarUrl} size="sm" /> : <span className="w-7 shrink-0" />)}
                      <div className={cn("flex max-w-[78%] flex-col gap-1", mine ? "items-end" : "items-start", pending && "opacity-60")}>
                        {first && !mine && open.peer === "office" && <span className="px-1 text-[11px] text-muted">{sender?.name ?? "Volt munkatárs"}</span>}
                        {m.body && (
                          <p
                            className={cn(
                              "pop-in rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap [--pop-from:6px]",
                              mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md bg-surface text-ink",
                            )}
                            title={time.format(new Date(m.createdAt))}
                          >
                            <MessageText body={m.body} members={members} me={me} mine={mine} />
                          </p>
                        )}
                        {m.ref && <RefCardView refCard={m.ref} mine={mine} />}
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

        <ChatComposer
          members={members}
          me={me}
          sending={sending}
          onSend={send}
          placeholder={open.peer === "office" ? "Üzenet az irodának… (@ a megemlítéshez)" : `Üzenet ${open.name} részére…`}
        />
        {error && (
          <p role="alert" className="px-4 pb-3 text-xs text-danger">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
