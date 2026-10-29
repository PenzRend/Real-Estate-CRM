"use client";

import { ClipboardPaste, ExternalLink } from "lucide-react";
import { useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { APPLE_ACCOUNT_URL, normalizeAppPassword } from "@/lib/mail/app-password";

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-white">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <p className="text-sm text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

/**
 * Getting an Apple app password, for agents who never heard of one: open
 * Apple's page, make the password, paste it here. The field is named
 * `password`; a pasted normal password is pointed out before sending.
 */
export function AppPasswordSteps({ error, id = "app-password" }: { error?: string; id?: string }) {
  const [value, setValue] = useState("");
  const [pasteFailed, setPasteFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const looksWrong = value.trim().length >= 8 && !normalizeAppPassword(value);

  async function paste() {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      setValue(normalizeAppPassword(text) ?? text);
      setPasteFailed(false);
    } catch {
      // The browser didn't allow reading the clipboard: ordinary pasting still works.
      setPasteFailed(true);
      input.current?.focus();
    }
  }

  return (
    <ol className="flex flex-col gap-4">
      <Step n={1} title="Nyisd meg az Apple-fiókodat, és jelentkezz be azzal az Apple ID-val, amit az iPhone-odon használsz.">
        <a href={APPLE_ACCOUNT_URL} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "sm", "w-fit")}>
          <ExternalLink /> Apple-fiók megnyitása
        </a>
      </Step>
      <Step n={2} title="Ott: Bejelentkezés és biztonság → Alkalmazásspecifikus jelszavak → írd be: Flavio → Létrehozás. Az Apple mutat egy jelszót – másold ki." />
      <Step n={3} title="Illeszd be ide a kapott jelszót:">
        <div className="flex gap-2">
          <Input
            ref={input}
            id={id}
            name="password"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="abcd-efgh-ijkl-mnop"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setValue((v) => normalizeAppPassword(v) ?? v)}
            aria-invalid={Boolean(error) || looksWrong}
            aria-describedby={`${id}-note`}
            className="font-mono tracking-wide"
          />
          <Button type="button" variant="secondary" onClick={paste} className="h-11" title="Beillesztés a vágólapról">
            <ClipboardPaste /> <span className="hidden sm:inline">Beillesztés</span>
          </Button>
        </div>
        <p id={`${id}-note`} className={error || looksWrong ? "text-xs text-danger" : "text-xs text-muted"}>
          {error ??
            (looksWrong
              ? "Ez nem úgy néz ki, mint az Apple-től kapott jelszó (16 betű, pl. abcd-efgh-ijkl-mnop). A rendes Apple-jelszavad itt nem működik."
              : pasteFailed
                ? "A böngésző nem engedte a beillesztést: kattints a mezőbe, és nyomd meg a Ctrl+V-t (Macen ⌘+V)."
                : "Nem a rendes Apple-jelszavad – azt sosem kérjük el. Ezt a jelszót bármikor visszavonhatod az Apple-fiókodban.")}
        </p>
      </Step>
    </ol>
  );
}
