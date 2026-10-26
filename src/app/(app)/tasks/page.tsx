import { CheckSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TaskRow } from "@/components/crm/items";
import { NewTaskForm } from "@/components/crm/new-task-form";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { getCurrentUser } from "@/lib/auth";
import { listClientOptions, listTasks, type TaskView } from "@/lib/db/activity";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Feladatok" };

const views: { key: TaskView; label: string; empty: string }[] = [
  { key: "today", label: "Mai", empty: "Mára nincs feladat." },
  { key: "overdue", label: "Lejárt", empty: "Nincs lejárt feladat. Szép munka!" },
  { key: "upcoming", label: "Közelgő", empty: "Nincs közelgő vagy határidő nélküli feladat." },
  { key: "completed", label: "Kész", empty: "Még nincs elvégzett feladat." },
];

async function TasksContent({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const params = await searchParams;
  const view = views.find((v) => v.key === params.view) ?? views[0];
  const user = await getCurrentUser();
  const now = new Date();
  const [tasks, clients] = await Promise.all([listTasks(user, view.key, now), listClientOptions(user)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Feladatok" description="Utánkövetések és teendők ügyfelekhez, ingatlanokhoz kötve." />

      <NewTaskForm clients={clients} />

      <nav aria-label="Nézetek" className="flex w-fit gap-1 rounded-full border border-border p-1">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/tasks?view=${v.key}`}
            aria-current={v.key === view.key ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm transition-colors",
              v.key === view.key ? "bg-primary font-medium text-white" : "text-muted hover:text-ink",
            )}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      <Card>
        {tasks.length ? (
          <ul className="divide-y divide-border">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} overdue={view.key === "overdue"} done={t.status === "completed"} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={CheckSquare} title={view.empty} description="Feladat keletkezik a hívásjegyzetekből is: az AI kigyűjti, mit vállaltál." />
        )}
      </Card>
    </div>
  );
}

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TasksContent searchParams={searchParams} />
    </Suspense>
  );
}
