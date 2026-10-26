"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { insertTasks, SaveError, setTaskStatus } from "@/lib/db/activity";
import { parseTaskForm, type TaskFieldErrors } from "@/lib/validation/activity";

export type TaskFormState = {
  errors?: TaskFieldErrors;
  formError?: string;
  values?: Record<string, string>;
  /** Increments on each successful save so the form can reset itself. */
  saved?: number;
};

export async function createTaskAction(prev: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const user = await getCurrentUser();
  const values = Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));
  const parsed = parseTaskForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values };
  try {
    await insertTasks(user, [{ ...parsed.data, source: "manual" }]);
  } catch (error) {
    if (error instanceof SaveError) return { formError: error.userMessage, values };
    throw error;
  }
  refresh();
  return { saved: (prev.saved ?? 0) + 1 };
}

export async function setTaskDoneAction(id: string, done: boolean) {
  const user = await getCurrentUser();
  await setTaskStatus(user, id, done);
  refresh();
}
