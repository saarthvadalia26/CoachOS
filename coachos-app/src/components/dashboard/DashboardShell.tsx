import type { ReactNode } from "react";

import { SubmitButton } from "@/components/ui/submit-button";
import { logout } from "@/lib/auth/actions";
import type { AppRole } from "@/lib/auth/permissions";
import { getNotificationBellData } from "@/lib/communication/actions";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import {
  DashboardSidebar,
  type DashboardPageKey,
} from "@/components/dashboard/DashboardSidebar";
import { PageContainer } from "@/components/ui/responsive-layout";

type DashboardShellProps = {
  activePage: DashboardPageKey;
  instituteName: string;
  userEmail?: string;
  userName?: string | null;
  title: string;
  children: ReactNode;
  role: AppRole;
};

export async function DashboardShell({
  activePage,
  instituteName,
  role,
  userEmail,
  userName,
  title,
  children,
}: DashboardShellProps) {
  const displayName = userName?.trim() || userEmail || "your account";
  const roleLabel = role.replaceAll("_", " ");
  const notificationData = await getNotificationBellData();
  const notificationKey = [
    notificationData.unreadCount,
    ...notificationData.notifications.map(
      (notification) => `${notification.id}:${notification.unread}`,
    ),
  ].join("|");

  return (
    <main className="min-h-[100dvh] h-[100dvh] w-full max-w-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full max-w-full flex-col lg:flex-row">
        <DashboardSidebar
          activePage={activePage}
          instituteName={instituteName}
          role={role}
          displayName={displayName}
          roleLabel={roleLabel}
          notificationBell={
            <NotificationBell
              key={notificationKey}
              notifications={notificationData.notifications}
              unreadCount={notificationData.unreadCount}
            />
          }
          logoutForm={
            <form action={logout}>
              <SubmitButton pendingLabel="Signing out..." variant="outline" className="w-full">
                Log out
              </SubmitButton>
            </form>
          }
        />

        <section className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden py-6">
          <PageContainer className="flex flex-col gap-8">
            <header className="flex min-w-0 flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  {instituteName}
                </p>
                <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-2 break-words text-muted-foreground">
                  Signed in as {displayName}.
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
                <div className="hidden lg:block">
                  <NotificationBell
                    key={notificationKey}
                    notifications={notificationData.notifications}
                    unreadCount={notificationData.unreadCount}
                  />
                </div>
                <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                  {roleLabel}
                </span>
                <form action={logout}>
                  <SubmitButton pendingLabel="Signing out..." variant="outline">
                    Log out
                  </SubmitButton>
                </form>
              </div>
            </header>

            {children}
          </PageContainer>
        </section>
      </div>
    </main>
  );
}
