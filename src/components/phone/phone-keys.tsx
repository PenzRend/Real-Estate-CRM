"use client";

import { Check, CircleAlert, Copy, Smartphone } from "lucide-react";
import { useState, useTransition } from "react";
import { createPhoneKeyAction, revokePhoneKeyAction } from "@/app/(app)/settings/phone-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { actionFailed } from "@/lib/action-failed";
import type { PhoneKey } from "@/lib/phone/calls";

const when = new Intl.DateTimeFormat("hu-HU", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Budapest" });

/**
 * Keys for the Android call-capture app: calls with clients land on their
 * timeline by themselves. The key is shown once; each phone gets its own.
 */
/** `appUrl`: where agents get the Android app; until it is set the card says "Hamarosan" and offers no keys. */
export function PhoneKeys({ keys, appUrl }: { keys: PhoneKey[]; appUrl: string | null }) {
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<{ key: string; server: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => setCopied(what),
      () => setCopied(null),
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:col-span-2">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface text-muted">
          <Smartphone className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">Hívásnapló Androidról</p>
          <p className="mt-0.5 text-sm text-muted">
            Az ügyfeleiddel folytatott hívások maguktól bekerülnek az előzményeik közé. Ehhez a{" "}
            {appUrl ? (
              <a href={appUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline underline-offset-2">
                Flavio Android-alkalmazás
              </a>
            ) : (
              "Flavio Android-alkalmazás"
            )}{" "}
            kell.
          </p>
        </div>
        {!appUrl && <Badge>Hamarosan</Badge>}
      </div>

      {keys.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-xl bg-surface text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="font-medium text-ink">{k.label}</span>
              <span className="text-xs text-muted">{k.lastUsedAt ? `utoljára: ${when.format(new Date(k.lastUsedAt))}` : "még nem használt"}</span>
              <Button variant="ghost" size="sm" className="ml-auto" onClick={() => start(() => revokePhoneKeyAction(k.id))} disabled={busy}>
                Kikapcsolás
              </Button>
            </li>
          ))}
        </ul>
      )}

      {created ? (
        <div className="flex flex-col gap-2 rounded-xl bg-surface p-3" role="status">
          <p className="text-xs text-muted">Írd be az alkalmazásba (csak most látszik):</p>
          {[
            { what: "server", label: "Szerver", value: created.server },
            { what: "key", label: "Kulcs", value: created.key },
          ].map((f) => (
            <div key={f.what} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-muted">{f.label}</span>
              <Input value={f.value} readOnly onFocus={(e) => e.currentTarget.select()} aria-label={f.label} className="bg-background text-xs" />
              <Button variant="secondary" size="sm" onClick={() => copy(f.value, f.what)} aria-label={`${f.label} másolása`}>
                {copied === f.what ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          ))}
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setCreated(null)}>
            Kész
          </Button>
        </div>
      ) : (
        appUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="pl. Samsung telefon"
              aria-label="A telefon neve"
              className="h-9 max-w-56 text-sm"
              maxLength={100}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const r = await createPhoneKeyAction(label).catch(actionFailed);
                  if (r.ok) {
                    setCreated({ key: r.key, server: r.server });
                    setLabel("");
                    setError(null);
                  } else setError(r.error);
                })
              }
            >
              {busy ? "Létrehozás…" : "Telefon hozzáadása"}
            </Button>
          </div>
        )
      )}
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert className="size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
