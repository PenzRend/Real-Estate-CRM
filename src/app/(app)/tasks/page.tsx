import { CheckSquare, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { cn } from "@/lib/cn";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export const metadata: Metadata = { title: "Feladatok" };

const views = [
  { key: "today", label: "Mai" },
  { key: "overdue", label: "Lejárt" },
  { key: "upcoming", label: "Közelgő" },
  { key: "completed", label: "Kész" },
] as const;

async function TasksContent({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const params = await searchParams;
  const view = views.find((v) => v.key === params.view)?.key ?? "today";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Feladatok"
        description="Utánkövetések és teendők ügyfelekhez, ingatlanokhoz kötve."
        actions={
          <ButtonLink href="/tasks?new=1">
            <Plus /> Új feladat
          </ButtonLink>
        }
      />

      <nav aria-label="Nézetek" className="flex w-fit gap-1 rounded-full border border-border p-1">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/tasks?view=${v.key}`}
            aria-current={v.key === view ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              v.key === view ? "bg-primary font-medium text-white" : "text-muted hover:text-ink",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card>
        <EmptyState
          icon={CheckSquare}
          title="Nincs feladat ebben a nézetben"
          description="Feladatot létrehozhatsz kézzel, egy hívás rögzítésekor, vagy egy AI-javaslat elfogadásával."
        />
      </Card>
    </div>
  );
}

// Request-time content streams in behind Suspense so navigation stays instant.
export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TasksContent searchParams={searchParams} />
    </Suspense>
  );
}
