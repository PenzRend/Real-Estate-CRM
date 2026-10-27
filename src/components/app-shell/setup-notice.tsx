import { PlugZap } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Shown while the database is not connected, so empty screens are not mistaken for real data. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="mb-8 flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning">
      <PlugZap className="mt-0.5 size-4 shrink-0" />
      <p>Az adatbázis még nincs csatlakoztatva, ezért minden lista üres.</p>
    </div>
  );
}
