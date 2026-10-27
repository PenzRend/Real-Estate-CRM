"use client";

import { CircleAlert } from "lucide-react";
import { useActionState } from "react";
import { joinAction, type JoinState } from "@/app/(auth)/invite/[token]/actions";
import { Button } from "@/components/ui/button";

export function JoinForm({ token, workspace }: { token: string; workspace: string }) {
  const [state, action, pending] = useActionState<JoinState>(() => joinAction(token), {});
  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {state.error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Csatlakozás…" : `Csatlakozás: ${workspace}`}
      </Button>
    </form>
  );
}
