"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type AppRole, type Permission } from "@/lib/auth/permissions-base";
import { ThemeToggle } from "@/components/ui/theme-toggle";

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
} from "lucide-react";

export type DashboardPageKey =
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

type DashboardSidebarProps = {
  activePage: DashboardPageKey;
  instituteName: string;
  role: AppRole;
  displayName: string;
  roleLabel: string;
  notificationBell: React.ReactNode;
  logoutForm: React.ReactNode;
};

export function DashboardSidebar({
  activePage,
  instituteName,
  role,
  displayName,
  roleLabel,
  notificationBell,
  logoutForm,
}: DashboardSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const renderNavLinks = (isMobile: boolean) => {
    return navItems.map((item) => {
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
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {item.label}
          </span>
        );
      }

      return (
        <Link
          key={item.label}
          href={item.href}
          onClick={() => {
            if (isMobile) {
              setIsOpen(false);
            }
          }}
          aria-current={isActive ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            isActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {item.label}
        </Link>
      );
    });
  };

  const renderLogo = () => (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 text-lg font-semibold tracking-tight transition-colors hover:text-sidebar-primary"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
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
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="flex h-16 w-full items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? "Close sidebar menu" : "Open sidebar menu"}
            className="flex size-10 items-center justify-center rounded-md border border-sidebar-border text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          <div className="min-w-0">
            {renderLogo()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {notificationBell}
        </div>
      </header>

      {/* Mobile Sidebar Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-xs lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar p-5 text-sidebar-foreground transition-transform duration-200 ease-in-out lg:hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between mb-5">
          {renderLogo()}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar menu"
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-5 min-w-0 border-b border-sidebar-border pb-3">
          <p className="truncate text-sm font-semibold text-foreground">
            {instituteName}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Institute operations
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
          {renderNavLinks(true)}
        </nav>

        <div className="mt-auto border-t border-sidebar-border pt-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <div className="rounded-lg bg-sidebar-accent/40 p-3">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {roleLabel}
            </p>
          </div>
          {logoutForm}
        </div>
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar px-5 py-5 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:max-w-64 lg:flex-col lg:overflow-y-auto shrink-0">
        <div className="mb-5">
          {renderLogo()}
          <p className="mt-3 truncate text-sm font-medium">{instituteName}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Institute operations
          </p>
        </div>
        <nav className="flex-1 space-y-1">
          {renderNavLinks(false)}
        </nav>
        <div className="mt-auto pt-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="mt-1 text-xs capitalize text-muted-foreground">
              {roleLabel}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
