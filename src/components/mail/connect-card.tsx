import { Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { connectPaths, type MailProvider } from "@/lib/mail/provider";

/** Levelek before any mailbox is connected: what connecting does, and the ways to do it. */
export function ConnectCard({ providers }: { providers: MailProvider[] }) {
  const other = providers.length === 0;
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <span className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-muted shadow-float">
          <Mail className="size-5" />
        </span>
        <h2 className="text-2xl">Kapcsold össze a postafiókodat</h2>
        <p className="text-muted">
          Az ügyfeleiddel váltott levelek és a portálokról (ingatlan.com, Jófogás…) érkező érdeklődések maguktól megjelennek itt. Egy kattintással ügyféllé,
          előzménnyé és feladattá alakíthatod őket.
        </p>
        <ul className="flex flex-col gap-2 text-sm text-text">
          {[
            "Alapból csak olvasási jog. Válaszolni a Flavióból akkor tudsz, ha a küldést külön engedélyezed – és akkor is csak a te kattintásodra megy el levél. Törölni vagy módosítani nem tud.",
            "Csak a releváns leveleket tároljuk: ügyfelekkel váltott, portálról érkező vagy ingatlanos érdeklődés. A többit nem mentjük el.",
            "A hozzáférési kulcsot titkosítva tároljuk, és bármikor leválaszthatod.",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" /> {t}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {providers.map((p, i) => (
            <a key={p} href={connectPaths[p]} className={buttonClasses(i === 0 ? "primary" : "secondary", "lg")}>
              <Mail className="size-4" /> {p === "outlook" ? "Outlook / Microsoft 365" : "Gmail / Google Workspace"}
            </a>
          ))}
          <Link href="/inbox/connect" className={buttonClasses(other ? "primary" : "secondary", "lg")}>
            <Mail className="size-4" /> Céges, iCloud vagy más
          </Link>
        </div>
        <p className="text-xs text-muted">Több postafiókot is összekapcsolhatsz – például a céges és a saját címedet –, a levelek egy helyen jelennek meg.</p>
      </div>
    </Card>
  );
}
