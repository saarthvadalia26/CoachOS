import { CheckCircle2, FileText, IndianRupee, Plus, Search } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { PaginationControls } from "@/components/dashboard/PaginationControls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  hasAnyPermission,
  hasPermission,
  requirePermission,
} from "@/lib/auth/permissions";
import { getTodayDateValue } from "@/lib/attendance/date";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  defaultPageSize,
  getPage,
  getPageSummary,
  getPaginationRange,
  getSearchTerm,
  isDateValue,
} from "@/lib/dashboard/list-controls";
import { createFeeRecord, markFeeRecordPaid } from "@/lib/fees/actions";
import { type FeeStatus, getFeeStatus } from "@/lib/fees/status";
import { formatDate } from "@/lib/formatters/date";

type FeesPageProps = {
  searchParams: Promise<{
    branchId?: string;
    endDate?: string;
    error?: string;
    page?: string;
    q?: string;
    startDate?: string;
    status?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Fees",
};

type Student = {
  branch_id: string;
  id: string;
  full_name: string;
  phone: string | null;
};

type FeeRecord = {
  branch_id: string;
  id: string;
  student_id: string;
  amount_due: number | string;
  amount_paid: number | string;
  due_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
};

function toAmount(value: number | string) {
  return Number(value);
}

function formatCurrency(value: number | string) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(toAmount(value));
}

function getStatusBadgeVariant(status: FeeStatus) {
  if (status === "paid") {
    return "secondary";
  }

  if (status === "overdue") {
    return "destructive";
  }

  return "outline";
}

function getStudentLabel(student: Student | undefined) {
  if (!student) {
    return "Student not available";
  }

  return student.phone
    ? `${student.full_name} | ${student.phone}`
    : student.full_name;
}

function getSelectedStatus(value: string | null | undefined) {
  return value === "pending" || value === "paid" || value === "overdue"
    ? value
    : "";
}

export default async function FeesPage({ searchParams }: FeesPageProps) {
  const context = await requirePermission("fees.view");
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedStatus = getSelectedStatus(params.status);
  const startDate = isDateValue(params.startDate) ? params.startDate! : "";
  const endDate = isDateValue(params.endDate) ? params.endDate! : "";
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const todayDate = getTodayDateValue();
  const canCreateFees = hasPermission(role, "fees.create");
  const canMarkFeesPaid =
    hasPermission(role, "fees.mark_paid") &&
    hasPermission(role, "fees.record_payment");
  const canManageFees = hasAnyPermission(role, [
    "fees.create",
    "fees.mark_paid",
    "fees.record_payment",
    "fees.update",
  ]);
  const canViewFeeReports =
    role === "owner" || role === "branch_manager" || role === "accountant";
  const feeReportParams = new URLSearchParams();

  if (branchScope.selectedBranchId) {
    feeReportParams.set("branchId", branchScope.selectedBranchId);
  }

  if (searchTerm) {
    feeReportParams.set("q", searchTerm);
  }

  if (selectedStatus) {
    feeReportParams.set("status", selectedStatus);
  }

  if (startDate) {
    feeReportParams.set("startDate", startDate);
  }

  if (endDate) {
    feeReportParams.set("endDate", endDate);
  }

  const feeReportsQueryString = feeReportParams.toString();
  const feeReportsHref = feeReportsQueryString
    ? `/dashboard/fees/reports?${feeReportsQueryString}`
    : "/dashboard/fees/reports";

  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone")
    .eq("institute_id", institute.id)
    .order("full_name", { ascending: true });
  let feeRecordsQuery = supabase
    .from("fee_records")
    .select(
      "id, branch_id, student_id, amount_due, amount_paid, due_date, status, notes, created_at",
      { count: "exact" },
    )
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });
  let searchStudentsQuery = supabase
    .from("students")
    .select("id")
    .eq("institute_id", institute.id);

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
    feeRecordsQuery = feeRecordsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
    searchStudentsQuery = searchStudentsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
    feeRecordsQuery = feeRecordsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
    searchStudentsQuery = searchStudentsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  let searchStudentIds: string[] = [];

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    const { data: searchStudentRows, error: searchStudentsError } =
      await searchStudentsQuery.or(
        `full_name.ilike.${searchPattern},phone.ilike.${searchPattern}`,
      );

    if (searchStudentsError) {
      console.error("fees student search failed", searchStudentsError);
      searchStudentIds = [];
    } else {
      searchStudentIds = (searchStudentRows ?? []).map((student) => student.id);
    }

    feeRecordsQuery = searchStudentIds.length
      ? feeRecordsQuery.in("student_id", searchStudentIds)
      : feeRecordsQuery.eq(
          "student_id",
          "00000000-0000-0000-0000-000000000000",
        );
  }

  if (selectedStatus === "paid") {
    feeRecordsQuery = feeRecordsQuery.eq("status", "paid");
  } else if (selectedStatus === "overdue") {
    feeRecordsQuery = feeRecordsQuery
      .neq("status", "paid")
      .lt("due_date", todayDate);
  } else if (selectedStatus === "pending") {
    feeRecordsQuery = feeRecordsQuery
      .neq("status", "paid")
      .or(`due_date.is.null,due_date.gte.${todayDate}`);
  }

  if (startDate) {
    feeRecordsQuery = feeRecordsQuery.gte("due_date", startDate);
  }

  if (endDate) {
    feeRecordsQuery = feeRecordsQuery.lte("due_date", endDate);
  }

  const [studentsResponse, feeRecordsResponse] = await Promise.all([
    studentsQuery,
    feeRecordsQuery.range(paginationRange.from, paginationRange.to),
  ]);

  const students = (studentsResponse.data ?? []) as Student[];
  const feeRecords = (feeRecordsResponse.data ?? []) as FeeRecord[];
  const totalFeeRecords = feeRecordsResponse.count ?? 0;
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const queryError = Boolean(studentsResponse.error ?? feeRecordsResponse.error);

  const feeRecordsWithStatus = feeRecords.map((record) => {
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
      remainingAmount: Math.max(amountDue - amountPaid, 0),
      status,
    };
  });

  const totals = feeRecordsWithStatus.reduce(
    (summary, record) => {
      summary.dueAmount += record.amountDue;
      summary.paidAmount += record.amountPaid;

      if (record.status === "paid") {
        summary.paidRecords += 1;
      } else if (record.status === "overdue") {
        summary.overdueRecords += 1;
      } else {
        summary.pendingRecords += 1;
      }

      return summary;
    },
    {
      dueAmount: 0,
      overdueRecords: 0,
      paidAmount: 0,
      paidRecords: 0,
      pendingRecords: 0,
    },
  );
  const filterParams = {
    branchId: branchScope.selectedBranchId,
    endDate,
    q: searchTerm,
    startDate,
    status: selectedStatus,
  };
  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedStatus ||
      startDate ||
      endDate ||
      branchScope.selectedBranchId,
  );

  return (
    <DashboardShell
      activePage="fees"
      instituteName={institute.name}
      role={role}
      title="Fees"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find fee records</CardTitle>
            <CardDescription>
              Search by student name or phone, then filter by status and due
              date.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid min-w-0 gap-4">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <Label className="w-full min-w-0">
                  Search
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Student name or phone"
                  />
                </Label>
                {branchScope.showOwnerBranchFilter ? (
                  <Label className="w-full min-w-0">
                    Branch
                    <select
                      name="branchId"
                      defaultValue={branchScope.selectedBranchId ?? ""}
                      className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
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
                <Label className="w-full min-w-0">
                  Status
                  <select
                    name="status"
                    defaultValue={selectedStatus}
                    className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </Label>
                <Label className="w-full min-w-0">
                  Due from
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="startDate"
                    type="date"
                    defaultValue={startDate}
                  />
                </Label>
                <Label className="w-full min-w-0">
                  Due to
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="endDate"
                    type="date"
                    defaultValue={endDate}
                  />
                </Label>
              </div>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/dashboard/fees">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {canViewFeeReports ? (
          <div className="flex justify-end">
            <Button asChild variant="outline">
              <Link href={feeReportsHref}>
                <FileText aria-hidden="true" data-icon="inline-start" />
                Fee reports
              </Link>
            </Button>
          </div>
        ) : null}

        <ActionMessage
          error={
            queryError
              ? "Fee records are unavailable right now. Please try again."
              : null
          }
        />

        <div
          className={
            canManageFees
              ? "grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"
              : "grid gap-6"
          }
        >
          {canCreateFees ? (
            <Card id="create-fee-record">
              <CardHeader>
                <CardTitle className="text-xl">Create fee record</CardTitle>
                <CardDescription>
                  Create a fee record for a student and track payment status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {students.length ? (
                  <form action={createFeeRecord} className="grid gap-4">
                    <Label>
                      Student
                      <select
                        required
                        name="studentId"
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                      >
                        <option value="">Select student</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {getStudentLabel(student)}
                          </option>
                        ))}
                      </select>
                    </Label>
                    <Label>
                      Amount due
                      <Input
                        required
                        min="0.01"
                        name="amountDue"
                        step="0.01"
                        type="number"
                        placeholder="5000"
                      />
                    </Label>
                    <Label>
                      Amount paid
                      <Input
                        min="0"
                        name="amountPaid"
                        step="0.01"
                        type="number"
                        placeholder="0"
                      />
                    </Label>
                    <Label>
                      Due date
                      <Input name="dueDate" type="date" />
                    </Label>
                    <Label>
                      Notes
                      <Input
                        name="notes"
                        type="text"
                        placeholder="Optional billing note"
                      />
                    </Label>
                    <SubmitButton className="mt-1" pendingLabel="Creating...">
                      <Plus aria-hidden="true" data-icon="inline-start" />
                      Create fee record
                    </SubmitButton>
                  </form>
                ) : (
                  <EmptyState
                    actionHref="/dashboard/students"
                    actionLabel="View students"
                    title="No students available"
                    description="Add students before creating fee records."
                  />
                )}
              </CardContent>
            </Card>
          ) : null}

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Total due
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {formatCurrency(totals.dueAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Amount collected
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {formatCurrency(totals.paidAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <p className="text-sm font-medium text-muted-foreground">
                  Pending or overdue
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {totals.pendingRecords + totals.overdueRecords}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <CardTitle className="text-xl">Fee records</CardTitle>
                <CardDescription>
                  {getPageSummary({
                    page,
                    shownCount: feeRecordsWithStatus.length,
                    totalCount: totalFeeRecords,
                  })}{" "}
                  in {institute.name}
                </CardDescription>
              </div>
              <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                <Badge variant="secondary">Paid {totals.paidRecords}</Badge>
                <Badge variant="outline">Pending {totals.pendingRecords}</Badge>
                <Badge variant="destructive">
                  Overdue {totals.overdueRecords}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {feeRecordsWithStatus.length ? (
                <div className="grid gap-4">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {feeRecordsWithStatus.map((record) => {
                    const student = studentsById.get(record.student_id);

                    return (
                      <article
                        key={record.id}
                        className="flex flex-col gap-4 p-4 xl:flex-row xl:items-start xl:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-lg font-semibold leading-tight text-foreground">
                            {student?.full_name ?? "Student not available"}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getStatusBadgeVariant(record.status)}
                            >
                              {record.status}
                            </Badge>
                            <Badge variant="outline">
                              {branchesById.get(record.branch_id)?.name ??
                                "Branch"}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                            <span className="whitespace-nowrap">
                              Due {formatCurrency(record.amountDue)}
                            </span>
                            <span className="inline-flex items-center gap-x-2 whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className="hidden text-muted-foreground/60 sm:inline"
                              >
                                |
                              </span>
                              <span>Paid {formatCurrency(record.amountPaid)}</span>
                            </span>
                            <span className="inline-flex items-center gap-x-2 whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className="hidden text-muted-foreground/60 sm:inline"
                              >
                                |
                              </span>
                              <span>
                                Balance {formatCurrency(record.remainingAmount)}
                              </span>
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span className="whitespace-nowrap">
                              Due date: {formatDate(record.due_date)}
                            </span>
                            {record.notes ? (
                              <span className="inline-flex min-w-0 items-start gap-x-2">
                                <span
                                  aria-hidden="true"
                                  className="hidden shrink-0 text-muted-foreground/60 sm:inline"
                                >
                                  |
                                </span>
                                <span className="break-words">
                                  {record.notes}
                                </span>
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-start gap-2 xl:justify-end">
                          {record.status === "paid" ? (
                            <Badge variant="secondary">
                              <CheckCircle2
                                aria-hidden="true"
                                className="mr-1 size-3"
                              />
                              Paid
                            </Badge>
                          ) : canMarkFeesPaid ? (
                            <form action={markFeeRecordPaid}>
                              <input
                                name="feeRecordId"
                                type="hidden"
                                value={record.id}
                              />
                              <SubmitButton
                                pendingLabel="Updating..."
                                variant="outline"
                              >
                                <IndianRupee
                                  aria-hidden="true"
                                  data-icon="inline-start"
                                />
                                Mark paid
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </article>
                    );
                    })}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/fees"
                    page={page}
                    pageSize={defaultPageSize}
                    params={filterParams}
                    totalCount={totalFeeRecords}
                  />
                </div>
              ) : (
                <EmptyState
                  actionHref={
                    !hasActiveFilters && canCreateFees
                      ? "/dashboard/fees#create-fee-record"
                      : undefined
                  }
                  actionLabel="Create fee record"
                  title={
                    hasActiveFilters
                      ? "No fee records match these filters"
                      : "No fee records yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Adjust your search, status, branch, or due date filters to find fee records."
                      : "Create fee records to track payment status and pending balances."
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </section>
    </DashboardShell>
  );
}
