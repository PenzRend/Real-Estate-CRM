import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductTour } from "./product-tour";

/** The walkthrough, open on its own for someone who has not seen it yet. */
export async function TourGate() {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("tour_seen_at").eq("id", user.id).maybeSingle();
  return <ProductTour show={!!data && !(data as { tour_seen_at: string | null }).tour_seen_at} />;
}
