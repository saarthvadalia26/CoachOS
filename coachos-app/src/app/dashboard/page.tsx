import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CalendarDays, GraduationCap, UserPlus } from "lucide-react";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import { getDashboardContext } from "@/lib/dashboard/context";
import { formatDate, formatDateRange } from "@/lib/formatters/date";

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </article>
  );
}

type DashboardPageProps = {
  searchParams: Promise<{
    branchId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const context = await getDashboardContext();
  const { accessibleBranches, claims, institute, profile, role, supabase } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const todayDate = getTodayDateValue();
  const canViewAttendance = hasPermission(role, "attendance.view");
  const canViewFees = hasPermission(role, "fees.view");
  const activeAcademicYearQuery = supabase
    .from("academic_years")
    .select("id, name, start_date, end_date")
    .eq("institute_id", institute.id)
    .eq("is_active", true)
    .maybeSingle();

  let studentsQuery = supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("institute_id", institute.id);
  let batchesQuery = supabase
    .from("batches")
    .select("id", { count: "exact", head: true })
    .eq("institute_id", institute.id);
  let pendingFeesQuery = supabase
    .from("fee_records")
    .select("id", { count: "exact", head: true })
    .eq("institute_id", institute.id)
    .eq("status", "pending");
  let attendanceSessionsQuery = supabase
    .from("attendance_sessions")
    .select("id", { count: "exact", head: true })
    .eq("institute_id", institute.id)
    .eq("session_date", todayDate);

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
    batchesQuery = batchesQuery.eq("branch_id", branchScope.selectedBranchId);
    pendingFeesQuery = pendingFeesQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
    attendanceSessionsQuery = attendanceSessionsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
    batchesQuery = batchesQuery.in("branch_id", branchScope.visibleBranchIds);
    pendingFeesQuery = pendingFeesQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
    attendanceSessionsQuery = attendanceSessionsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  const [
    studentsResponse,
    batchesResponse,
    pendingFeesResponse,
    attendanceSessionsResponse,
    activeAcademicYearResponse,
  ] = await Promise.all([
    studentsQuery,
    batchesQuery,
    canViewFees ? pendingFeesQuery : Promise.resolve({ count: null, error: null }),
    canViewAttendance
      ? attendanceSessionsQuery
      : Promise.resolve({ count: null, error: null }),
    activeAcademicYearQuery,
  ]);

  const activeAcademicYear = activeAcademicYearResponse.data as {
    end_date: string;
    id: string;
    name: string;
    start_date: string;
  } | null;
  const metrics = [
    {
      label: "Academic Year",
      value: activeAcademicYear?.name ?? "Not set",
      helper: activeAcademicYear
        ? formatDateRange(activeAcademicYear.start_date, activeAcademicYear.end_date)
        : "No active academic year",
    },
    {
      label: "Total Students",
      value: String(studentsResponse.count ?? 0),
      helper: `Students in ${branchScope.selectedBranchName}`,
    },
    {
      label: "Active Batches",
      value: String(batchesResponse.count ?? 0),
      helper: `Batches in ${branchScope.selectedBranchName}`,
    },
    canViewFees
      ? {
          label: "Pending Fee Records",
          value: String(pendingFeesResponse.count ?? 0),
          helper: `Pending records in ${branchScope.selectedBranchName}`,
        }
      : null,
    canViewAttendance
      ? {
          label: "Attendance Records Today",
          value: String(attendanceSessionsResponse.count ?? 0),
          helper: `${branchScope.selectedBranchName} | ${formatDate(todayDate)}`,
        }
      : null,
  ].filter(
    (metric): metric is { helper: string; label: string; value: string } =>
      Boolean(metric),
  );

  const queryError = Boolean(
    studentsResponse.error ??
      batchesResponse.error ??
      pendingFeesResponse.error ??
      attendanceSessionsResponse.error ??
      activeAcademicYearResponse.error,
  );
  const hasNoUsefulData =
    !activeAcademicYear &&
    (studentsResponse.count ?? 0) === 0 &&
    (batchesResponse.count ?? 0) === 0;
  const quickActions = [
    hasPermission(role, "branches.create")
      ? {
          href: "/dashboard/branches",
          icon: Building2,
          label: "Add Branch",
        }
      : null,
    hasPermission(role, "academic_years.create")
      ? {
          href: "/dashboard/settings/academic-years",
          icon: CalendarDays,
          label: "Create Academic Year",
        }
      : null,
    hasPermission(role, "students.create")
      ? {
          href: "/dashboard/students",
          icon: UserPlus,
          label: "Add Student",
        }
      : null,
    hasPermission(role, "batches.create")
      ? {
          href: "/dashboard/batches",
          icon: GraduationCap,
          label: "Create Batch",
        }
      : null,
  ].filter(
    (
      action,
    ): action is {
      href: string;
      icon: typeof Building2;
      label: string;
    } => Boolean(action),
  );

  return (
    <DashboardShell
      activePage="overview"
      instituteName={institute.name}
      role={role}
      title="Overview"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section>
        {branchScope.showOwnerBranchFilter ? (
          <div className="mb-6">
            <BranchFilter
              branches={accessibleBranches}
              selectedBranchId={branchScope.selectedBranchId}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight">
            Dashboard snapshot
          </h2>
          <p className="text-sm text-muted-foreground">
            Current operational summary for your institute.
          </p>
        </div>

        {queryError ? (
          <ActionMessage
            className="mt-5"
            error="Dashboard metrics are unavailable right now. Please try again."
          />
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
            />
          ))}
        </div>

        {hasNoUsefulData && quickActions.length ? (
          <div className="mt-6 rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold tracking-tight">
                Welcome to CoachOS.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Start by setting up your first branch, academic year, students,
                and batches.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {quickActions.map((action) => {
                const Icon = action.icon;

                return (
                  <Button
                    key={action.href}
                    asChild
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    <Link href={action.href}>
                      <Icon aria-hidden="true" data-icon="inline-start" />
                      {action.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
