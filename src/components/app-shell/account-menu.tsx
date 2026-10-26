import { LogOut } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Signed-in user and logout. Rendered inside a Suspense boundary. */
export async function AccountMenu() {
  if (!isSupabaseConfigured) return null;
  const user = await getCurrentUser();
  const initials = (user.fullName ?? user.email)
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-strong text-xs font-medium text-ink">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user.fullName ?? user.email}</p>
        <p className="truncate text-xs text-muted">{user.organization.name}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink"
          aria-label="Kijelentkezés"
          title="Kijelentkezés"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AccountMenuSkeleton() {
  return <div className="h-[62px] animate-pulse rounded-2xl bg-surface" />;
}
