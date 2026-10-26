import { Suspense } from "react";
import { AccountMenu, AccountMenuSkeleton } from "@/components/app-shell/account-menu";
import { SetupNotice } from "@/components/app-shell/setup-notice";
import { MobileNav, Sidebar } from "@/components/app-shell/sidebar";

// Signed-out visitors are redirected by src/proxy.ts; pages verify the user
// again through getCurrentUser() and RLS guards every row.
export default function AppLayout({ children }: LayoutProps<"/">) {
  const account = (
    <Suspense fallback={<AccountMenuSkeleton />}>
      <AccountMenu />
    </Suspense>
  );

  return (
    <div className="flex min-h-dvh">
      <Sidebar account={account} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav account={account} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
          <SetupNotice />
          {children}
        </main>
      </div>
    </div>
  );
}
