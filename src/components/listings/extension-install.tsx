"use client";

import { Check, Copy, Download, Puzzle } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

/** Where the extension can be installed with one click, once it is in the stores. */
export type InstallLinks = { chrome: string | null; safari: string | null };

/** The extension's bridge script marks CRM pages it runs on. */
const marked = () => typeof document !== "undefined" && document.documentElement.dataset.crmExtension === "1";

/**
 * Whether the import extension runs on this page. It marks the page and
 * answers a ping; this keeps asking, so the page notices a fresh install.
 */
export function useExtensionInstalled() {
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    if (installed) return;
    const ping = () => {
      if (marked()) setInstalled(true);
      else window.postMessage({ type: "crm-extension-ping" }, window.location.origin);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source === window && e.origin === window.location.origin && e.data?.type === "crm-extension-pong") setInstalled(true);
    };
    window.addEventListener("message", onMessage);
    window.addEventListener("focus", ping);
    ping();
    const t = setInterval(ping, 2000);
    return () => {
      clearInterval(t);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("focus", ping);
    };
  }, [installed]);
  return installed;
}

type Browser = "chrome" | "edge" | "safari" | "ios" | "other";

function detectBrowser(): Browser {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android|Mobile/.test(ua)) return "other";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\/|Chromium\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

const linkButton =
  "inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2";

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => void navigator.clipboard.writeText(address).then(() => setCopied(true))}
      className="inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs text-ink hover:bg-border"
    >
      {address} {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
    </button>
  );
}

/** Chromium without a store listing yet: download, then "Load unpacked". */
function ManualSteps({ browser }: { browser: "chrome" | "edge" }) {
  const page = browser === "edge" ? "edge://extensions" : "chrome://extensions";
  return (
    <div className="flex flex-col gap-3">
      <a href="/api/extension/download" className={linkButton} style={{ alignSelf: "flex-start" }}>
        <Download className="size-4" /> Bővítmény letöltése
      </a>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-text">
        <li>Csomagold ki a letöltött fájlt (jobb klikk → Összes kibontása).</li>
        <li>
          Nyisd meg új lapon: <CopyAddress address={page} /> és kapcsold be jobbra fent a <b>Fejlesztői mód</b>ot.
        </li>
        <li>
          Kattints a <b>Kicsomagolt bővítmény betöltése</b> gombra, és válaszd ki a kibontott <b>flavio-bovitmeny</b> mappát.
        </li>
      </ol>
      <p className="text-xs text-muted">Ez az oldal magától észreveszi, ha kész – nem kell semmit beállítanod.</p>
    </div>
  );
}

/**
 * "Install the extension" on the import page, for the browser in use: the
 * store's one-click install when the listing exists, else a guided download.
 * Hidden once the extension runs here.
 */
export function ExtensionInstall({ installed, links }: { installed: boolean; links: InstallLinks }) {
  const [browser, setBrowser] = useState<Browser | null>(null);
  // The browser is only known in the browser, so it is read once after mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setBrowser(detectBrowser()), []);
  if (installed || !browser) return null;

  let body: React.ReactNode;
  if ((browser === "chrome" || browser === "edge") && links.chrome) {
    body = (
      <a href={links.chrome} target="_blank" rel="noopener noreferrer" className={linkButton} style={{ alignSelf: "flex-start" }}>
        <Puzzle className="size-4" /> Hozzáadás a {browser === "edge" ? "böngészőhöz" : "Chrome-hoz"}
      </a>
    );
  } else if (browser === "chrome" || browser === "edge") {
    body = <ManualSteps browser={browser} />;
  } else if ((browser === "safari" || browser === "ios") && links.safari) {
    body = (
      <>
        <a href={links.safari} target="_blank" rel="noopener noreferrer" className={linkButton} style={{ alignSelf: "flex-start" }}>
          <Puzzle className="size-4" /> Letöltés az App Store-ból
        </a>
        <p className="text-xs text-muted">Telepítés után: Safari → Beállítások → Bővítmények → kapcsold be a „Flavio – Importálás” bővítményt.</p>
      </>
    );
  } else if (browser === "safari" || browser === "ios") {
    body = (
      <p className="text-sm text-text">
        A Safari-bővítmény hamarosan elérhető az App Store-ban. Addig nyisd meg a Flaviót Chrome-ban a bővítményhez, vagy importálj a hirdetés linkjével, illetve
        a szövegének beillesztésével.
      </p>
    );
  } else {
    body = (
      <p className="text-sm text-text">
        A bővítmény Chrome-ban (számítógépen) és Safariban működik. Ebben a böngészőben a hirdetés linkjével vagy szövegével importálhatsz.
      </p>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
          <Puzzle className="size-4" />
        </span>
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-ink">Importáló bővítmény</h2>
          <p className="text-sm text-muted">Az ingatlan.com hirdetéseidet egy kattintással hozza át, a fotókkal együtt. Egyszer kell telepíteni.</p>
        </div>
      </div>
      {body}
    </Card>
  );
}
