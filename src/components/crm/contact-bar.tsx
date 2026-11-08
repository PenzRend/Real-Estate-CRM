"use client";

import { Check, Loader2, Mail, MessageCircle, MessageSquare, MessageSquareText, Phone, X } from "lucide-react";
import { useState, useTransition } from "react";
import { logCallAction } from "@/app/(app)/clients/contact-actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import { CALL_OUTCOMES, contactLinks, messageLinks, quickTexts, type CallOutcome } from "@/lib/contact";
import { cn } from "@/lib/cn";

type Channel = "call" | "whatsapp" | "viber";

const FOLLOW_UPS = [
  { value: "", label: "Nincs utánkövetés" },
  { value: "1", label: "Holnap" },
  { value: "2", label: "2 nap múlva" },
  { value: "3", label: "3 nap múlva" },
  { value: "7", label: "1 hét múlva" },
  { value: "14", label: "2 hét múlva" },
];

function Action({ href, icon: Icon, label, onClick, external }: { href: string; icon: typeof Phone; label: string; onClick?: () => void; external?: boolean }) {
  return (
    <a
      href={href}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex min-w-16 flex-col items-center gap-1 rounded-2xl border border-border bg-background px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface"
    >
      <Icon className="size-[18px]" />
      {label}
    </a>
  );
}

/**
 * One tap to call, text, WhatsApp, Viber or email the client. After a call
 * (or a WhatsApp / Viber call) Flavio asks how it went: one tap logs it on the
 * timeline, with a follow-up task if needed.
 */
export function ContactBar({ clientId, phone, email, clientName = "", agentName = null }: { clientId: string; phone: string | null; email: string | null; clientName?: string; agentName?: string | null }) {
  const links = contactLinks(phone);
  const [texts, setTexts] = useState(false);
  const [asking, setAsking] = useState<Channel | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [followUp, setFollowUp] = useState("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  if (!links && !email) return null;

  const ask = (channel: Channel) => {
    setAsking(channel);
    setOutcome(null);
    setFollowUp("");
    setNote("");
    setDone(null);
    setError(null);
  };
  const pick = (o: CallOutcome) => {
    setOutcome(o);
    const days = CALL_OUTCOMES[o].followUpDays;
    setFollowUp(days == null ? "" : String(days));
  };
  const save = () =>
    start(async () => {
      if (!outcome || !asking) return;
      const r = await logCallAction({ clientId, outcome, note, followUpDays: followUp ? Number(followUp) : null, channel: asking }).catch(actionFailed);
      if (r.ok) {
        setDone(followUp ? "Rögzítve, és bekerült az utánkövetés." : "Rögzítve az előzmények közé.");
        setAsking(null);
      } else setError(r.error);
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {links && (
          <>
            <Action href={links.call} icon={Phone} label="Hívás" onClick={() => ask("call")} />
            <Action href={links.sms} icon={MessageSquare} label="SMS" />
            <Action href={links.whatsapp} icon={MessageCircle} label="WhatsApp" onClick={() => ask("whatsapp")} external />
            <Action href={links.viber} icon={MessageCircle} label="Viber" onClick={() => ask("viber")} />
            <button
              type="button"
              onClick={() => setTexts((t) => !t)}
              aria-expanded={texts}
              className={cn(
                "flex min-w-16 flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 text-xs font-medium text-ink transition-colors hover:border-border-strong hover:bg-surface",
                texts ? "border-ink bg-surface" : "border-border bg-background",
              )}
            >
              <MessageSquareText className="size-[18px]" />
              Gyors üzenet
            </button>
          </>
        )}
        {email && <Action href={`mailto:${email}`} icon={Mail} label="E-mail" />}
      </div>

      {texts && (
        // Ready texts: the phone opens with the message written, the agent only presses send.
        <ul className="reveal flex flex-col divide-y divide-border rounded-2xl border border-border bg-background">
          {quickTexts(clientName, agentName).map((t) => {
            const m = messageLinks(phone, t.text);
            return (
              <li key={t.label} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{t.label}</span>
                  <span className="line-clamp-1 text-xs text-muted">{t.text.replace(/\n/g, " – ")}</span>
                </span>
                {m && (
                  <span className="flex shrink-0 gap-1.5">
                    <a href={m.sms} className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink hover:bg-surface">
                      SMS
                    </a>
                    <a href={m.whatsapp} target="_blank" rel="noopener noreferrer" className="rounded-full border border-border px-3 py-1 text-xs font-medium text-ink hover:bg-surface">
                      WhatsApp
                    </a>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {asking && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-background p-4 shadow-float" role="dialog" aria-label="Hogy ment a hívás?">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-ink">Hogy ment?</p>
            <button type="button" onClick={() => setAsking(null)} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink" aria-label="Nem rögzítem">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CALL_OUTCOMES) as CallOutcome[]).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => pick(o)}
                aria-pressed={outcome === o}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  outcome === o ? "border-primary bg-primary text-white" : "border-border text-text hover:border-border-strong",
                )}
              >
                {CALL_OUTCOMES[o].label}
              </button>
            ))}
          </div>
          {outcome && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_12rem]">
              <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="Egy mondat (nem kötelező): pl. szombaton jöhet megnézni" aria-label="Megjegyzés" className="h-10" />
              <Select value={followUp} onChange={(e) => setFollowUp(e.target.value)} aria-label="Utánkövetés" className="h-10">
                {FOLLOW_UPS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
          <div>
            <Button size="sm" onClick={save} disabled={!outcome || saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Rögzítés
            </Button>
          </div>
        </div>
      )}
      {done && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-success">
          <Check className="size-4" /> {done}
        </p>
      )}
    </div>
  );
}
