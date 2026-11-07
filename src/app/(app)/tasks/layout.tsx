import { Suspense, type ReactNode } from "react";
import { NewTaskForm, TasksPageForm } from "@/components/crm/new-task-form";
import { PageTransition } from "@/components/ui/list-suspense";
import { PageHeader } from "@/components/ui/page";
import { ViewTabs, ViewTabsPlaceholder } from "@/components/ui/view-tabs";
import { getCurrentUser } from "@/lib/auth";
import { listClientOptions } from "@/lib/db/activity";
import { taskViews } from "@/lib/tasks/views";

async function TaskForm() {
  const user = await getCurrentUser();
  return <TasksPageForm clients={await listClientOptions(user)} />;
}

/** What stays while Feladatok switches tabs: the header, the new-task form and the tabs. Only the list (page.tsx) loads. */
export default function TasksLayout({ children }: { children: ReactNode }) {
  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader title="Feladatok" description="Visszahívások és utánkövetések, ügyfelekhez és ingatlanokhoz kötve." />
      {/* The form itself, inert and without clients, while they load: same size, so nothing below moves. */}
      <Suspense
        fallback={
          <div inert>
            <NewTaskForm clients={[]} />
          </div>
        }
      >
        <TaskForm />
      </Suspense>
      <Suspense fallback={<ViewTabsPlaceholder label="Nézetek" items={taskViews} />}>
        <ViewTabs label="Nézetek" items={taskViews} />
      </Suspense>
      {children}
    </PageTransition>
  );
}
