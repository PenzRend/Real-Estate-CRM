"use client";

import { Check } from "lucide-react";
import { useOptimistic, useTransition } from "react";
import { setTaskDoneAction } from "@/app/(app)/tasks/actions";
import { cn } from "@/lib/cn";

/** Round checkbox that completes or reopens a task, with an instant optimistic tick. */
export function TaskToggle({ id, done, title }: { id: string; done: boolean; title: string }) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={optimisticDone}
      aria-label={optimisticDone ? `${title} – visszanyitás` : `${title} – kész`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          setOptimisticDone(!optimisticDone);
          await setTaskDoneAction(id, !optimisticDone);
        })
      }
      className={cn(
        "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border-[1.5px] transition-colors",
        optimisticDone ? "border-success bg-success text-white" : "border-border-strong hover:border-ink",
      )}
    >
      {optimisticDone && <Check className="size-3" strokeWidth={3} />}
    </button>
  );
}
