import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
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
  | "staff";

type NavItem = {
  activeKey: DashboardPageKey | "settings";
  enabled: boolean;
  href: string;
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
  },
  {
    label: "Branches",
    href: "/dashboard/branches",
    activeKey: "branches",
    enabled: true,
    permission: "branches.view",
    roles: ["owner", "branch_manager"],
  },
  {
    label: "Students",
    href: "/dashboard/students",
    activeKey: "students",
    enabled: true,
    permission: "students.view",
  },
  {
    label: "Batches",
    href: "/dashboard/batches",
    activeKey: "batches",
    enabled: true,
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
    permission: "fees.view",
    roles: ["owner", "branch_manager", "operations_staff", "accountant"],
  },
  {
    label: "Staff",
    href: "/dashboard/staff",
    activeKey: "staff",
    enabled: true,
    permission: "staff.view",
    roles: ["owner"],
  },
  {
    label: "Settings",
    href: "#",
    activeKey: "settings",
    enabled: false,
    permission: "settings.manage",
    roles: ["owner"],
  },
];

type DashboardShellProps = {
  activePage: DashboardPageKey;
  instituteName: string;
  userEmail?: string;
  title: string;
  children: ReactNode;
  role: AppRole;
};

export function DashboardShell({
  activePage,
  instituteName,
  role,
  userEmail,
  title,
  children,
}: DashboardShellProps) {
  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="flex min-h-full flex-col md:flex-row">
        <aside className="border-b border-border bg-card px-4 py-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:px-5">
          <div className="mb-5">
            <p className="text-lg font-semibold tracking-tight">CoachOS</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Institute workspace
            </p>
          </div>
          <nav className="flex gap-2 overflow-x-auto md:grid md:overflow-visible">
            {navItems.map((item) => {
              const isActive = item.activeKey === activePage;
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
                    className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
                  >
                    {item.label}
                  </span>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                      : "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
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
                  Signed in as {userEmail ?? "your account"}.
                </p>
              </div>
              <form action={logout}>
                <Button type="submit" variant="outline">
                  Log out
                </Button>
              </form>
            </header>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
