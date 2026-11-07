import { CheckSquare } from "lucide-react";
import type { Metadata } from "next";
import { TaskRow } from "@/components/crm/items";
import { Card } from "@/components/ui/card";
import { ListSuspense } from "@/components/ui/list-suspense";
import { EmptyState } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listTasks } from "@/lib/db/activity";
import { startOfZonedDay } from "@/lib/i18n/timezone";
import { taskViews } from "@/lib/tasks/views";

export const metadata: Metadata = { title: "Feladatok" };

async function TaskList({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const params = await searchParams;
  const view = taskViews.find((v) => v.value === params.view) ?? taskViews[0];
  const user = await getCurrentUser();
  const now = new Date();
  // The default tab also holds what was missed, overdue first, like the dashboard: nothing slips past it.
  const tasks =
    view.value === "today"
      ? (await Promise.all([listTasks(user, "overdue", now), listTasks(user, "today", now)])).flat()
      : await listTasks(user, view.value, now);
  const today = startOfZonedDay(now, user.timezone);

  return (
    <Card>
      {tasks.length ? (
        <ul className="divide-y divide-border">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} overdue={t.dueAt != null && new Date(t.dueAt) < today} done={t.status === "completed"} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={CheckSquare} title={view.empty} description="Feladat keletkezik a hívásjegyzetekből is: az AI kigyűjti, mit vállaltál." />
      )}
    </Card>
  );
}

export default function TasksPage({ searchParams }: PageProps<"/tasks">) {
  return (
    <ListSuspense>
      <TaskList searchParams={searchParams} />
    </ListSuspense>
  );
}
