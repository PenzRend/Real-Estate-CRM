import { Suspense, ViewTransition, type ReactNode } from "react";
import { LoadingScreen } from "./loading-screen";

/**
 * A page's per-request content with its loading screen, and the motion
 * between them: pages fade in and out on navigation, the loading screen fades away
 * and the content rises in when it is ready (React view transitions; see the
 * matching classes in globals.css). Without browser support it just swaps.
 */
export function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div>
        <Suspense
          fallback={
            <ViewTransition exit="skeleton-exit" default="none">
              <LoadingScreen />
            </ViewTransition>
          }
        >
          <ViewTransition enter="content-enter" default="none">
            {children}
          </ViewTransition>
        </Suspense>
      </div>
    </ViewTransition>
  );
}
