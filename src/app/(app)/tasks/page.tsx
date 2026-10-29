import { CheckSquare } from "lucide-react";
import type { Metadata } from "next";
import { TaskRow } from "@/components/crm/items";
import { Card } from "@/components/ui/card";
import { ListSuspense } from "@/components/ui/list-suspense";
import { EmptyState } from "@/components/ui/page";
import { getCurrentUser } from "@/lib/auth";
import { listTasks } from "@/lib/db/activity";
import { taskViews } from "@/lib/tasks/views";

export const metadata: Metadata = { title: "Feladatok" };

async function TaskList({ searchParams }: Pick<PageProps<"/tasks">, "searchParams">) {
  const params = await searchParams;
  const view = taskViews.find((v) => v.value === params.view) ?? taskViews[0];
  const user = await getCurrentUser();
  const tasks = await listTasks(user, view.value, new Date());

  return (
    <Card>
      {tasks.length ? (
        <ul className="divide-y divide-border">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} overdue={view.value === "overdue"} done={t.status === "completed"} />
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
