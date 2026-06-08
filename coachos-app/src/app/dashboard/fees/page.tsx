import { CheckCircle2, FileText, IndianRupee, Plus } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
import { createFeeRecord, markFeeRecordPaid } from "@/lib/fees/actions";
import { type FeeStatus, getFeeStatus } from "@/lib/fees/status";

type FeesPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
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

export default async function FeesPage({ searchParams }: FeesPageProps) {
  const context = await requirePermission("fees.view");
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
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
  const feeReportsHref = branchScope.selectedBranchId
    ? `/dashboard/fees/reports?branchId=${encodeURIComponent(
        branchScope.selectedBranchId,
      )}`
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
    )
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
    feeRecordsQuery = feeRecordsQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
    feeRecordsQuery = feeRecordsQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  const [studentsResponse, feeRecordsResponse] = await Promise.all([
    studentsQuery,
    feeRecordsQuery,
  ]);

  const students = (studentsResponse.data ?? []) as Student[];
  const feeRecords = (feeRecordsResponse.data ?? []) as FeeRecord[];
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
        {branchScope.showOwnerBranchFilter ? (
          <BranchFilter
            branches={accessibleBranches}
            selectedBranchId={branchScope.selectedBranchId}
          />
        ) : null}

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
            params.error ??
            (queryError
              ? "Fee records are unavailable right now. Please try again."
              : null)
          }
          success={params.success}
        />

        <div
          className={
            canManageFees ? "grid gap-6 lg:grid-cols-[360px_1fr]" : "grid gap-6"
          }
        >
          {canCreateFees ? (
            <Card>
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
                  <div className="grid gap-4">
                    <p className="text-sm text-muted-foreground">
                      Add students before creating fee records.
                    </p>
                    <Button asChild variant="outline">
                      <Link href="/dashboard/students">View students</Link>
                    </Button>
                  </div>
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
            <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
              <div>
                <CardTitle className="text-xl">Fee records</CardTitle>
                <CardDescription>
                  {feeRecords.length}{" "}
                  {feeRecords.length === 1 ? "record" : "records"} in{" "}
                  {institute.name}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Paid {totals.paidRecords}</Badge>
                <Badge variant="outline">Pending {totals.pendingRecords}</Badge>
                <Badge variant="destructive">
                  Overdue {totals.overdueRecords}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {feeRecordsWithStatus.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {feeRecordsWithStatus.map((record) => {
                    const student = studentsById.get(record.student_id);

                    return (
                      <article
                        key={record.id}
                        className="grid gap-4 p-4 xl:grid-cols-[1fr_auto] xl:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">
                              {student?.full_name ?? "Student not available"}
                            </h3>
                            <Badge
                              variant={getStatusBadgeVariant(record.status)}
                            >
                              {record.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Due {formatCurrency(record.amountDue)} | Paid{" "}
                            {formatCurrency(record.amountPaid)} | Balance{" "}
                            {formatCurrency(record.remainingAmount)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Branch:{" "}
                            {branchesById.get(record.branch_id)?.name ??
                              "Branch"}{" "}
                            |{" "}
                            Due date: {record.due_date ?? "Not set"}
                            {record.notes ? ` | ${record.notes}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
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
              ) : (
                <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                  No fee records match the selected filters.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </section>
    </DashboardShell>
  );
}
