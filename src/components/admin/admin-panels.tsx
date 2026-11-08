"use client";

import { Check, Copy, Mail, X } from "lucide-react";
import { useState, useTransition } from "react";
import { createSignupCodeAction, revokeSignupCodeAction, type CodeResult } from "@/app/(app)/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import type { SignupCode } from "@/lib/admin";
import { formatDate } from "@/lib/i18n/format";

const statusLabel: Record<SignupCode["status"], { label: string; tone: "success" | "neutral" | "warning" }> = {
  open: { label: "Szabad", tone: "success" },
  used: { label: "Felhasználva", tone: "neutral" },
  revoked: { label: "Visszavonva", tone: "warning" },
  expired: { label: "Lejárt", tone: "warning" },
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Kimásolva" : label}
    </Button>
  );
}

/** The new code: the link to send, ready in the admin's own email program. */
function NewCode({ result, onClose }: { result: Extract<CodeResult, { ok: true }>; onClose: () => void }) {
  const subject = "Meghívó a Flavio pilotba";
  const body = `Szia${result.note ? ` ${result.note}` : ""}!\n\nItt a meghívód a Flavióba. Ezzel a linkkel tudsz regisztrálni:\n${result.link}\n\nA meghívókódod: ${result.code}\nEgyszer használható, 60 napig érvényes.`;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4" role="status">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">
          <span className="font-mono text-base font-medium">{result.code}</span>
          {(result.note || result.email) && <span className="text-muted"> · {[result.note, result.email].filter(Boolean).join(" · ")}</span>}
        </p>
        <button type="button" onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded-full text-muted hover:bg-background hover:text-ink" aria-label="Bezárás">
          <X className="size-4" />
        </button>
      </div>
      <Input value={result.link} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Regisztrációs link" className="bg-background text-xs" />
      <div className="flex flex-wrap gap-2">
        <a href={`mailto:${result.email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`} className={buttonClasses("primary", "sm")}>
          <Mail className="size-4" /> Küldés e-mailben
        </a>
        <CopyButton text={result.link} label="Link másolása" />
        <CopyButton text={result.code} label="Kód másolása" />
      </div>
    </div>
  );
}

export function SignupCodes({ codes }: { codes: SignupCode[] }) {
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<Extract<CodeResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="flex flex-col gap-4 sm:col-span-2">
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await createSignupCodeAction({ note, email }).catch(actionFailed);
            if (r.ok) {
              setResult(r);
              setError(null);
              setNote("");
              setEmail("");
            } else setError(r.error);
          });
        }}
      >
        <div className="flex-1">
          <Field label="Kinek" htmlFor="code-note">
            <Input id="code-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Kovács Anna, XY Ingatlan" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="E-mail-cím (nem kötelező)" htmlFor="code-email">
            <Input id="code-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} placeholder="Csak ezzel a címmel működjön" />
          </Field>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? "Készül…" : "Új kód"}
        </Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      {result && <NewCode result={result} onClose={() => setResult(null)} />}

      {codes.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {codes.map((c) => (
            <CodeRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CodeRow({ c }: { c: SignupCode }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const s = statusLabel[c.status];
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <span className="font-mono text-sm font-medium text-ink">{c.code}</span>
      <Badge tone={s.tone}>{s.label}</Badge>
      <span className="min-w-0 flex-1 truncate text-sm text-muted">
        {[c.note, c.email].filter(Boolean).join(" · ") || "—"}
        {c.status === "used" && c.usedBy && <span className="text-ink"> → {c.usedBy}</span>}
      </span>
      <span className="text-xs text-subtle tabular-nums">{formatDate(c.status === "used" ? c.usedAt : c.createdAt)}</span>
      {c.status === "open" && (
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const r = await revokeSignupCodeAction(c.id).catch(actionFailed);
              setError(r.ok ? null : r.error);
            })
          }
        >
          Visszavonás
        </Button>
      )}
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </li>
  );
}

