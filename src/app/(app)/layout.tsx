import { Suspense } from "react";
import { AssistantBubble } from "@/components/assistant/assistant-bubble";
import { AccountMenu, AccountMenuSkeleton } from "@/components/app-shell/account-menu";
import { CommandPalette } from "@/components/app-shell/command-palette";
import { Toaster } from "@/components/ui/toaster";
import { NavigationProgress } from "@/components/app-shell/navigation-progress";
import { SetupNotice } from "@/components/app-shell/setup-notice";
import { InstallBanner } from "@/components/app-shell/install-banner";
import { PilotUsage } from "@/components/app-shell/pilot-usage";
import { MobileNav, Sidebar } from "@/components/app-shell/sidebar";
import { TeamGate } from "@/components/app-shell/team-gate";
import { llmConfig } from "@/lib/ai/config";

// Signed-out visitors are redirected by src/proxy.ts; pages verify the user
// again through getCurrentUser() and RLS guards every row.
export default function AppLayout({ children }: LayoutProps<"/">) {
  const account = (
    <Suspense fallback={<AccountMenuSkeleton />}>
      <AccountMenu />
    </Suspense>
  );

  const team = (
    <Suspense fallback={null}>
      <TeamGate />
    </Suspense>
  );

  const plan = (
    <Suspense fallback={null}>
      <PilotUsage />
    </Suspense>
  );

  return (
    <div className="flex min-h-dvh">
      <Suspense>
        <NavigationProgress />
      </Suspense>
      <Sidebar account={account} team={team} plan={plan} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav account={account} team={team} plan={plan} />
        {/* Bottom padding keeps the last buttons clear of the assistant bubble; a page that needs the room (the calendar) marks itself data-wide. */}
        <main className="mx-auto w-full max-w-6xl flex-1 has-[[data-wide]]:max-w-[1600px] px-4 pt-8 pb-24 sm:px-8 sm:pt-10 sm:pb-24">
          <SetupNotice />
          <InstallBanner />
          {children}
        </main>
      </div>
      <Suspense>
        <AssistantBubble aiEnabled={llmConfig() != null} />
      </Suspense>
      <CommandPalette />
      <Toaster />
    </div>
  );
}
