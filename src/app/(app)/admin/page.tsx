import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AiLimits, SignupCodes } from "@/components/admin/admin-panels";
import { FormSection } from "@/components/ui/form-section";
import { PageHeader } from "@/components/ui/page";
import { PageSuspense } from "@/components/ui/page-suspense";
import { isPlatformAdmin, listSignupCodes, listWorkspaceUsage } from "@/lib/admin";
import { defaultMonthlyLimit } from "@/lib/ai/usage";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Pilot admin" };

async function AdminContent() {
  const user = await getCurrentUser();
  // Not a page for anyone else: it does not exist for them.
  if (!isPlatformAdmin(user)) notFound();
  const [codes, workspaces] = await Promise.all([listSignupCodes(), listWorkspaceUsage()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Pilot admin" description="Meghívókódok az új fiókokhoz, és a munkaterületek AI-használata ebben a hónapban." />
      {!createAdminClient() && (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink">A szerveren nincs beállítva a SUPABASE_SECRET_KEY, ezért ez az oldal üres.</p>
      )}
      <div>
        <FormSection
          number="01"
          title="Meghívókódok"
          description="Új fiókot csak kóddal lehet nyitni. Minden kód egyszer használható, 60 napig érvényes. Akit egy csapatba hívnak meg, annak nem kell kód."
        >
          <SignupCodes codes={codes} />
        </FormSection>
        <FormSection
          number="02"
          title="AI-keretek"
          description={`Havi AI-hívások munkaterületenként. Alapértelmezés: ${defaultMonthlyLimit() ?? "nincs korlát"} (AI_MONTHLY_LIMIT). Üresen hagyva az alapértelmezés érvényes.`}
        >
          <AiLimits workspaces={workspaces} />
        </FormSection>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <PageSuspense>
      <AdminContent />
    </PageSuspense>
  );
}
