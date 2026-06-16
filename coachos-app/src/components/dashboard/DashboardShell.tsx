import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Building2,
  CalendarCheck,
  Activity,
  BookOpenCheck,
  ClipboardCheck,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  Users,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { SubmitButton } from "@/components/ui/submit-button";
import { logout } from "@/lib/auth/actions";
import {
  hasPermission,
  type AppRole,
  type Permission,
} from "@/lib/auth/permissions";
import { getNotificationBellData } from "@/lib/communication/actions";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

type DashboardPageKey =
  | "overview"
  | "branches"
  | "students"
  | "batches"
  | "homework"
  | "attendance"
  | "tests"
  | "communication"
  | "fees"
  | "import"
  | "reports"
  | "activity"
  | "staff"
  | "settings";

type NavItem = {
  activeKey: DashboardPageKey;
  enabled: boolean;
  href: string;
  icon: LucideIcon;
  label: string;
  permission?: Permission;
  roles?: readonly AppRole[];
};

const navItems: NavItem[] = [
  {
    label: "Overview",
    href: "/dashboard",
    activeKey: "overview",
    enabled: true,
    icon: LayoutDashboard,
  },
  {
    label: "Branches",
    href: "/dashboard/branches",
    activeKey: "branches",
    enabled: true,
    icon: Building2,
    permission: "branches.view",
    roles: ["owner", "branch_manager"],
  },
  {
    label: "Students",
    href: "/dashboard/students",
    activeKey: "students",
    enabled: true,
    icon: Users,
    permission: "students.view",
  },
  {
    label: "Batches",
    href: "/dashboard/batches",
    activeKey: "batches",
    enabled: true,
    icon: GraduationCap,
    permission: "batches.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Homework",
    href: "/dashboard/homework",
    activeKey: "homework",
    enabled: true,
    icon: BookOpenCheck,
    permission: "homework.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Attendance",
    href: "/dashboard/attendance",
    activeKey: "attendance",
    enabled: true,
    icon: CalendarCheck,
    permission: "attendance.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Tests",
    href: "/dashboard/tests",
    activeKey: "tests",
    enabled: true,
    icon: ClipboardCheck,
    permission: "tests.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Fees",
    href: "/dashboard/fees",
    activeKey: "fees",
    enabled: true,
    icon: Receipt,
    permission: "fees.view",
    roles: ["owner", "branch_manager", "operations_staff", "accountant"],
  },
  {
    label: "Reports",
    href: "/dashboard/reports",
    activeKey: "reports",
    enabled: true,
    icon: BarChart3,
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "accountant",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Activity",
    href: "/dashboard/activity",
    activeKey: "activity",
    enabled: true,
    icon: Activity,
    permission: "activity.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "accountant",
      "academic_coordinator",
    ],
  },
  {
    label: "Communication",
    href: "/dashboard/communication",
    activeKey: "communication",
    enabled: true,
    icon: MessageSquare,
    permission: "communications.view",
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "accountant",
      "academic_coordinator",
      "teacher",
    ],
  },
  {
    label: "Import",
    href: "/dashboard/import",
    activeKey: "import",
    enabled: true,
    icon: FileUp,
    roles: [
      "owner",
      "branch_manager",
      "operations_staff",
      "academic_coordinator",
    ],
  },
  {
    label: "Staff",
    href: "/dashboard/staff",
    activeKey: "staff",
    enabled: true,
    icon: UserPlus,
    permission: "staff.view",
    roles: ["owner"],
  },
  {
    label: "Settings",
    href: "/dashboard/settings/academic-years",
    activeKey: "settings",
    enabled: true,
    icon: Settings,
    permission: "settings.manage",
    roles: ["owner"],
  },
];

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
    <main className="h-screen w-full max-w-full overflow-hidden bg-background text-foreground">
      <div className="flex h-full w-full max-w-full flex-col lg:flex-row">
        <aside className="w-full max-w-full overflow-hidden border-b border-sidebar-border bg-sidebar px-4 py-4 text-sidebar-foreground shrink-0 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:max-w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r lg:px-5">
          <div className="mb-5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight transition-colors hover:text-sidebar-primary"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-[#1e1b4b] text-white shadow-sm">
                <svg
                  className="size-4"
                  viewBox="0 0 28 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 4L12 12L4 20" />
                  <path d="M15 4L23 12L15 20" />
                </svg>
              </span>
              CoachOS
            </Link>
            <p className="mt-3 truncate text-sm font-medium">
              {instituteName}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Institute operations
            </p>
          </div>
          <nav className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1 lg:grid lg:flex-1 lg:content-start lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const isActive = item.activeKey === activePage;
              const Icon = item.icon;
              const canViewRole = !item.roles || item.roles.includes(role);
              const canViewItem =
                canViewRole &&
                (!item.permission || hasPermission(role, item.permission));

              if (!canViewItem) {
                return null;
              }

              if (!item.enabled) {
                return (
                  <span
                    key={item.label}
                    aria-disabled="true"
                    className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  prefetch
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "flex shrink-0 items-center gap-2 rounded-md bg-sidebar-primary px-3 py-2 text-sm font-medium text-sidebar-primary-foreground shadow-sm"
                      : "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 hidden rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 lg:block">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {roleLabel}
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8 xl:px-10">
          <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-8">
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
                <NotificationBell
                  key={notificationKey}
                  notifications={notificationData.notifications}
                  unreadCount={notificationData.unreadCount}
                />
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
          </div>
        </section>
      </div>
    </main>
  );
}
