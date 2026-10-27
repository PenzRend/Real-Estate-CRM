"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { createTaskAction, type TaskFormState } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { taskPriorityLabels } from "@/lib/i18n/labels";
import type { Option } from "@/lib/db/activity";

/** One-line task entry: title, due time, priority, optional client. */
export function NewTaskForm({ clients, defaultClientId, autoFocus }: { clients: Option[]; defaultClientId?: string; autoFocus?: boolean }) {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(createTaskAction, {});
  const title = useRef<HTMLInputElement>(null);
  const v = state.values ?? {};
  const errors = state.errors ?? {};

  // After a successful save the form remounts empty; keep typing flow going.
  useEffect(() => {
    if (state.saved) title.current?.focus();
  }, [state.saved]);

  return (
    <form action={action} key={state.saved ?? 0} className="rounded-2xl border border-border bg-background p-3" noValidate>
      <div className="flex flex-col gap-2 lg:flex-row">
        <Input
          ref={title}
          name="title"
          placeholder="Új feladat, pl. Visszahívni Pétert"
          aria-label="Feladat"
          autoFocus={autoFocus}
          defaultValue={v.title}
          aria-invalid={errors.title ? true : undefined}
          className="flex-1"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <Input name="due_at" type="datetime-local" aria-label="Határidő" defaultValue={v.due_at} className="col-span-2 sm:col-span-1 lg:w-52" />
          <Select name="priority" aria-label="Prioritás" defaultValue={v.priority || "normal"} className="lg:w-32">
            {Object.entries(taskPriorityLabels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
          <Select name="client_id" aria-label="Ügyfél" defaultValue={v.client_id ?? defaultClientId ?? ""} className="lg:w-48">
            <option value="">Ügyfél nélkül</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Button type="submit" disabled={pending} className="h-11">
            <Plus /> {pending ? "Mentés…" : "Hozzáadás"}
          </Button>
        </div>
      </div>
      {(state.formError || Object.keys(errors).length > 0) && (
        <p role="alert" className="mt-2 px-1 text-xs text-danger">
          {state.formError ?? Object.values(errors)[0]}
        </p>
      )}
    </form>
  );
}
