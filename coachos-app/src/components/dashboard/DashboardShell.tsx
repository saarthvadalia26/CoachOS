import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarCheck,
  GraduationCap,
  LayoutDashboard,
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

type DashboardPageKey =
  | "overview"
  | "branches"
  | "students"
  | "batches"
  | "attendance"
  | "fees"
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
    label: "Fees",
    href: "/dashboard/fees",
    activeKey: "fees",
    enabled: true,
    icon: Receipt,
    permission: "fees.view",
    roles: ["owner", "branch_manager", "operations_staff", "accountant"],
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

export function DashboardShell({
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

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="flex min-h-full flex-col md:flex-row">
        <aside className="border-b border-sidebar-border bg-sidebar px-4 py-4 text-sidebar-foreground md:flex md:min-h-screen md:w-64 md:flex-col md:border-b-0 md:border-r md:px-5">
          <div className="mb-5">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-lg font-semibold tracking-tight transition-colors hover:text-sidebar-primary"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground shadow-sm">
                C
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
          <nav className="flex gap-2 overflow-x-auto md:grid md:flex-1 md:content-start md:overflow-visible">
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
          <div className="mt-5 hidden rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3 md:block">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {roleLabel}
            </p>
          </div>
        </aside>

        <section className="flex-1 px-6 py-8 md:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {instituteName}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  {title}
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Signed in as {displayName}.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
