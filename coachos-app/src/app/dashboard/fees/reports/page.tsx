import { Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/ui/export-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { requirePermission, type AppRole } from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import { getSearchTerm } from "@/lib/dashboard/list-controls";
import { type FeeStatus, getFeeStatus } from "@/lib/fees/status";
import { formatDate } from "@/lib/formatters/date";

type FeeReportsPageProps = {
  searchParams: Promise<{
    branchId?: string;
    endDate?: string;
    q?: string;
    startDate?: string;
    status?: string;
    studentId?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Financial Summary",
};

type Student = {
  branch_id: string;
  full_name: string;
  id: string;
  phone: string | null;
};

type FeeRecord = {
  amount_due: number | string;
  amount_paid: number | string;
  branch_id: string;
  due_date: string | null;
  id: string;
  status: string | null;
  student_id: string;
};

const reportRoles: readonly AppRole[] = [
  "owner",
  "branch_manager",
  "accountant",
];

const feeStatusOptions = ["pending", "paid", "overdue"] as const;

function canViewFeeReports(role: AppRole) {
  return reportRoles.includes(role);
}

function isDateValue(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function getSelectedStatus(value: string | null | undefined) {
  if (feeStatusOptions.includes(value as FeeStatus)) {
    return value as FeeStatus;
  }

  return "";
}

function toAmount(value: number | string) {
  return Number(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function getFeeReportsHref(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const queryString = search.toString();

  return queryString
    ? `/dashboard/fees/reports?${queryString}`
    : "/dashboard/fees/reports";
}

function getFeeReportsExportHref(
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const queryString = search.toString();

  return queryString
    ? `/dashboard/fees/reports/export?${queryString}`
    : "/dashboard/fees/reports/export";
}

export default async function FeeReportsPage({
  searchParams,
}: FeeReportsPageProps) {
  const context = await requirePermission("fees.view");
  const { accessibleBranches, claims, institute, profile, role, supabase } =
    context;
  const params = await searchParams;

  if (!canViewFeeReports(role)) {
    return (
      <DashboardShell
        activePage="fees"
        instituteName={institute.name}
        role={role}
        title="Financial Summary"
        userEmail={claims.email}
        userName={profile.full_name}
      >
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
            <CardDescription>
              Fee reports are available to owners, branch managers, and
              accountants.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/dashboard/fees">Back to fees</Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedStatus = getSelectedStatus(params.status);
  const startDate = isDateValue(params.startDate) ? params.startDate! : "";
  const endDate = isDateValue(params.endDate) ? params.endDate! : "";
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );

  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone")
    .eq("institute_id", institute.id)
    .order("full_name", { ascending: true });

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    studentsQuery = studentsQuery.or(
      `full_name.ilike.${searchPattern},phone.ilike.${searchPattern}`,
    );
  }

  const { data: studentRows, error: studentsError } = await studentsQuery;
  const students = (studentRows ?? []) as Student[];
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const selectedStudent =
    students.find((student) => student.id === params.studentId) ?? null;
  const selectedStudentId = selectedStudent?.id ?? "";
  const searchStudentIds = students.map((student) => student.id);

  let feeRecordsQuery = supabase
    .from("fee_records")
    .select("id, branch_id, student_id, amount_due, amount_paid, due_date, status")
    .eq("institute_id", institute.id)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (branchScope.selectedBranchId) {
    feeRecordsQuery = feeRecordsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    feeRecordsQuery = feeRecordsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  if (selectedStudentId) {
    feeRecordsQuery = feeRecordsQuery.eq("student_id", selectedStudentId);
  } else if (searchTerm) {
    feeRecordsQuery = searchStudentIds.length
      ? feeRecordsQuery.in("student_id", searchStudentIds)
      : feeRecordsQuery.eq(
          "student_id",
          "00000000-0000-0000-0000-000000000000",
        );
  }

  if (startDate) {
    feeRecordsQuery = feeRecordsQuery.gte("due_date", startDate);
  }

  if (endDate) {
    feeRecordsQuery = feeRecordsQuery.lte("due_date", endDate);
  }

  const { data: feeRecordRows, error: feeRecordsError } = await feeRecordsQuery;
  const todayDate = getTodayDateValue();
  const feeRecords = ((feeRecordRows ?? []) as FeeRecord[])
    .map((record) => {
      const amountDue = toAmount(record.amount_due);
      const amountPaid = toAmount(record.amount_paid);
      const status = getFeeStatus({
        amountDue,
        amountPaid,
        dueDate: record.due_date,
        status: record.status,
        todayDate,
      });

      return {
        ...record,
        amountDue,
        amountPaid,
        pendingAmount: Math.max(amountDue - amountPaid, 0),
        status,
      };
    })
    .filter((record) => (selectedStatus ? record.status === selectedStatus : true));

  const pendingStudentIds = new Set<string>();
  const paidStudentIds = new Set<string>();

  const totals = feeRecords.reduce(
    (summary, record) => {
      summary.totalDue += record.amountDue;
      summary.totalCollected += record.amountPaid;
      summary.totalPending += record.pendingAmount;

      if (record.status === "paid") {
        paidStudentIds.add(record.student_id);
      } else {
        pendingStudentIds.add(record.student_id);
      }

      return summary;
    },
    {
      totalCollected: 0,
      totalDue: 0,
      totalPending: 0,
    },
  );
  const queryError = Boolean(studentsError ?? feeRecordsError);
  const resetHref = getFeeReportsHref({});
  const exportHref = getFeeReportsExportHref({
    branchId: branchScope.selectedBranchId,
    endDate,
    q: searchTerm,
    startDate,
    status: selectedStatus,
    studentId: selectedStudentId,
  });

  return (
    <DashboardShell
      activePage="fees"
      instituteName={institute.name}
      role={role}
      title="Financial Summary"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <CardTitle className="text-xl">Financial summary</CardTitle>
              <CardDescription>
                Summarize due, collected, and pending amounts for allowed fee
                records.
              </CardDescription>
            </div>
            <Button asChild variant="outline">
              <Link href="/dashboard/fees">Back to fees</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {queryError ? (
              <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Fee report data is unavailable right now. Please try again.
              </p>
            ) : null}

            <form className="grid gap-3">
              <div
                className={
                  branchScope.showOwnerBranchFilter
                    ? "grid gap-3 md:grid-cols-2 xl:grid-cols-6"
                    : "grid gap-3 md:grid-cols-2 xl:grid-cols-5"
                }
              >
                <Label>
                  Search
                  <Input
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Student name or phone"
                  />
                </Label>
                {branchScope.showOwnerBranchFilter ? (
                  <Label>
                    Branch
                    <select
                      name="branchId"
                      defaultValue={branchScope.selectedBranchId ?? ""}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                    >
                      <option value="">All branches</option>
                      {accessibleBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </Label>
                ) : null}

                <Label>
                  Student
                  <select
                    name="studentId"
                    defaultValue={selectedStudentId}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All students</option>
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name}
                        {student.phone ? ` | ${student.phone}` : ""}
                      </option>
                    ))}
                  </select>
                </Label>

                <Label>
                  Due from
                  <Input
                    name="startDate"
                    type="date"
                    defaultValue={startDate}
                  />
                </Label>

                <Label>
                  Due to
                  <Input name="endDate" type="date" defaultValue={endDate} />
                </Label>

                <Label>
                  Status
                  <select
                    name="status"
                    defaultValue={selectedStatus}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </Label>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <ExportButton
                  className="w-full sm:w-auto"
                  disabled={!feeRecords.length}
                  href={exportHref}
                  variant="outline"
                />
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href={resetHref}>Reset</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Total fee amount due
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {formatCurrency(totals.totalDue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Total amount collected
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {formatCurrency(totals.totalCollected)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Total pending amount
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {formatCurrency(totals.totalPending)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Pending student count
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {pendingStudentIds.size}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-sm font-medium text-muted-foreground">
                Paid student count
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {paidStudentIds.size}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <CardTitle className="text-lg">Filtered fee records</CardTitle>
              <CardDescription>
                {feeRecords.length}{" "}
                {feeRecords.length === 1 ? "record" : "records"} |{" "}
                {branchScope.selectedBranchName}
              </CardDescription>
            </div>
            <Badge variant="outline">Payment status</Badge>
          </CardHeader>
          <CardContent>
            {feeRecords.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {feeRecords.map((record) => {
                  const student = studentsById.get(record.student_id);

                  return (
                    <article
                      key={record.id}
                      className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start"
                    >
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-medium">
                          {student?.full_name ?? "Student not available"}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">
                            {branchesById.get(record.branch_id)?.name ??
                              "Branch"}
                          </span>
                          <span className="whitespace-nowrap">
                            <span
                              aria-hidden="true"
                              className="hidden text-muted-foreground/60 sm:inline"
                            >
                              |{" "}
                            </span>
                            Due date: {formatDate(record.due_date)}
                          </span>
                          <span className="whitespace-nowrap capitalize">
                            <span
                              aria-hidden="true"
                              className="hidden text-muted-foreground/60 sm:inline"
                            >
                              |{" "}
                            </span>
                            Status: {record.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-start gap-2 lg:justify-end">
                        <Badge variant="outline">
                          Due {formatCurrency(record.amountDue)}
                        </Badge>
                        <Badge variant="secondary">
                          Collected {formatCurrency(record.amountPaid)}
                        </Badge>
                        <Badge variant="outline">
                          Pending {formatCurrency(record.pendingAmount)}
                        </Badge>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No fee records match these filters"
                description="Adjust your branch, student, status, or due date filters to review fee records."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
