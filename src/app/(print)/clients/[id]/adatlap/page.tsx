import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/listings/print-button";
import { getIdentification } from "@/lib/aml/data";
import { ID_DOCUMENTS } from "@/lib/aml/identification";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/i18n/format";

// The customer due diligence data sheet, printed for the client to check and
// sign (with the PEP and beneficial owner declarations).

export const metadata: Metadata = { title: "Ügyfél-átvilágítási adatlap", robots: { index: false, follow: false } };

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[14rem_1fr] gap-3 border-b border-border/70 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-line text-ink">{value || "—"}</dd>
    </div>
  );
}

async function Sheet({ params }: Pick<PageProps<"/clients/[id]/adatlap">, "params">) {
  await connection();
  const { id } = await params;
  const user = await getCurrentUser();
  const ident = await getIdentification(user, id);
  if (!ident) notFound();
  const d = ident.data as Record<string, string>;
  const pep = ident.pep ? `Igen${d.pep_role ? ` – ${d.pep_role}` : ""}` : "Nem";

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10 text-[13px] print:max-w-none print:px-0 print:py-0">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link href={`/clients/${id}/azonositas`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Vissza
        </Link>
        <PrintButton />
      </div>
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <p className="text-xs tracking-wide text-muted uppercase">{user.organization.name}</p>
        <h1 className="text-[22px] leading-tight">Ügyfél-átvilágítási adatlap</h1>
        <p className="text-muted">A pénzmosás és a terrorizmus finanszírozása megelőzéséről és megakadályozásáról szóló 2017. évi LIII. törvény alapján · Felvéve: {formatDate(ident.verifiedOn)}</p>
      </header>

      <dl>
        {ident.kind === "person" ? (
          <>
            <Row label="Családi és utónév" value={d.full_name} />
            <Row label="Születési név" value={d.birth_name} />
            <Row label="Anyja születési neve" value={d.mother_name} />
            <Row label="Születési hely, idő" value={[d.birth_place, d.birth_date && formatDate(d.birth_date)].filter(Boolean).join(", ")} />
            <Row label="Állampolgárság" value={d.nationality} />
            <Row label="Lakcím" value={d.address} />
            <Row label="Azonosító okmány" value={`${ID_DOCUMENTS[d.document_type as keyof typeof ID_DOCUMENTS] ?? d.document_type}, ${d.document_number}${d.document_expires_on ? `, érvényes: ${formatDate(d.document_expires_on)}` : ""}`} />
            <Row label="Lakcímkártya száma" value={d.address_card_number} />
          </>
        ) : (
          <>
            <Row label="Cégnév" value={d.company_name} />
            <Row label="Cégjegyzékszám" value={d.registration_number} />
            <Row label="Adószám" value={d.tax_number} />
            <Row label="Székhely" value={d.seat} />
            <Row label="Képviselő" value={[d.representative_name, d.representative_document].filter(Boolean).join(", ")} />
            <Row label="Tényleges tulajdonos(ok)" value={d.beneficial_owners} />
          </>
        )}
        <Row label="Kiemelt közszereplő" value={pep} />
        <Row label="Az üzleti kapcsolat célja" value={d.purpose} />
        <Row label="A pénzeszközök forrása" value={d.source_of_funds} />
      </dl>

      <section className="flex flex-col gap-2 rounded-xl border border-border p-4">
        <h2 className="font-medium text-ink">Nyilatkozat</h2>
        <p>
          Alulírott kijelentem, hogy a fenti adatok a valóságnak megfelelnek; {ident.kind === "company" ? "a tényleges tulajdonos(ok) adatai teljesek; " : "saját nevemben járok el; "}
          kiemelt közszereplői státuszom: {ident.pep ? "igen" : "nem"}. Tudomásul veszem, hogy az adatokban bekövetkező változást 5 munkanapon belül be kell jelentenem.
        </p>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-10">
        {["Ügyfél aláírása", "Az ingatlanközvetítő aláírása"].map((label) => (
          <div key={label} className="flex flex-col gap-1">
            <div className="h-12 border-b border-ink" />
            <p className="text-xs text-muted">{label}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-muted">Kelt: ________________________, {formatDate(new Date())}</p>
    </article>
  );
}

export default function DueDiligenceSheetPage({ params }: PageProps<"/clients/[id]/adatlap">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-3xl animate-pulse rounded-2xl bg-surface" />}>
      <Sheet params={params} />
    </Suspense>
  );
}
