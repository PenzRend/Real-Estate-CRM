import { PageSkeleton } from "@/components/ui/page-skeleton";

// Suspense fallback for per-request pages (everything in the app is per user).
export default function Loading() {
  return <PageSkeleton />;
}
