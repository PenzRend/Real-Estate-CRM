import { ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { identificationStatus, type IdentificationSummary } from "@/lib/aml/identification";
import { formatDate } from "@/lib/i18n/format";
import { cn } from "@/lib/cn";

/** The client's AML identification: done (and when), missing, or its ID document expired. */
export function IdentificationCard({ clientId, summary, today }: { clientId: string; summary: IdentificationSummary | null; today: string }) {
  const s = identificationStatus(summary, today);
  const ok = s.state === "ok";
  return (
    <Card>
      <CardHeader title="Pénzmosás elleni azonosítás" />
      <div className="flex flex-col gap-3 p-5 text-sm">
        <p className={cn("flex items-center gap-2 font-medium", ok ? "text-success" : "text-warning")}>
          {ok ? <ShieldCheck className="size-4" /> : <ShieldAlert className="size-4" />} {s.label}
        </p>
        {summary ? (
          <p className="text-xs text-muted">
            Felvéve: {formatDate(summary.verifiedOn)}
            {summary.documentExpiresOn ? ` · okmány érvényes: ${formatDate(summary.documentExpiresOn)}` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted">Adásvétel vagy bérbeadás közvetítése előtt kötelező (Pmt.). Pár perc, az okmány alapján.</p>
        )}
        <Link href={`/clients/${clientId}/azonositas`} className={buttonClasses(ok ? "ghost" : "secondary", "sm", "w-fit")}>
          {summary ? "Megnyitás / frissítés" : "Azonosítás felvétele"}
        </Link>
      </div>
    </Card>
  );
}
