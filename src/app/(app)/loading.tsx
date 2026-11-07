import { LoadingScreen } from "@/components/ui/loading-screen";

// Suspense fallback for per-request pages (everything in the app is per user).
export default function Loading() {
  return <LoadingScreen />;
}
