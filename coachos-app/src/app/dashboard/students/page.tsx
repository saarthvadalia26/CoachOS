import { Archive, Eye, RotateCcw, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
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
  canAccessPermission,
  hasAnyPermission,
  hasPermission,
  requirePermission,
} from "@/lib/auth/permissions";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  defaultPageSize,
  getPage,
  getPageSummary,
  getPaginationRange,
  getSearchTerm,
} from "@/lib/dashboard/list-controls";
import {
  archiveStudent,
  createStudent,
  deleteStudent,
  reactivateStudent,
  updateStudent,
} from "@/lib/students/actions";

type StudentsPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
    page?: string;
    q?: string;
    recordState?: string;
    status?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Students",
};

type Student = {
  archived_at: string | null;
  branch_id: string;
  id: string;
  full_name: string;
  phone: string | null;
  parent_phone: string | null;
  status: string | null;
};

function getStatusLabel(status: string | null) {
  return status === "inactive" ? "Inactive" : "Active";
}

function getSelectedStatus(value: string | null | undefined) {
  return value === "active" || value === "inactive" ? value : "";
}

function getSelectedRecordState(value: string | null | undefined) {
  return value === "archived" || value === "all" ? value : "active";
}

function getContactValue(value: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue || null;
}

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const context = await requirePermission("students.view");
  const {
    accessibleBranches,
    supabase,
    claims,
    institute,
    profile,
    role,
  } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedStatus = getSelectedStatus(params.status);
  const selectedRecordState = getSelectedRecordState(params.recordState);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const canCreateStudents = hasPermission(role, "students.create");
  const canUpdateStudents = hasPermission(role, "students.update");
  const canManageStudents = hasAnyPermission(role, [
    "students.create",
    "students.update",
    "students.delete",
  ]);

  let studentsQuery = supabase
    .from("students")
    .select(
      "id, branch_id, full_name, phone, parent_phone, status, archived_at",
      {
        count: "exact",
      },
    )
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    studentsQuery = studentsQuery.or(
      `full_name.ilike.${searchPattern},phone.ilike.${searchPattern},parent_phone.ilike.${searchPattern}`,
    );
  }

  if (selectedStatus === "inactive") {
    studentsQuery = studentsQuery.eq("status", "inactive");
  } else if (selectedStatus === "active") {
    studentsQuery = studentsQuery.or("status.eq.active,status.is.null");
  }

  if (selectedRecordState === "archived") {
    studentsQuery = studentsQuery.not("archived_at", "is", null);
  } else if (selectedRecordState === "active") {
    studentsQuery = studentsQuery.is("archived_at", null);
  }

  const { data: studentRows, count: studentsCount, error: studentsError } =
    await studentsQuery.range(paginationRange.from, paginationRange.to);
  const students = (studentRows ?? []) as Student[];
  const totalStudents = studentsCount ?? 0;
  const studentIds = students.map((student) => student.id);
  const historicalStudentIds = new Set<string>();
  let historyLookupFailed = false;

  if (studentIds.length) {
    const [attendanceRows, auditRows, feeRows] = await Promise.all([
      supabase
        .from("attendance_records")
        .select("student_id")
        .in("student_id", studentIds),
      supabase
        .from("attendance_audit_logs")
        .select("student_id")
        .in("student_id", studentIds),
      supabase
        .from("fee_records")
        .select("student_id")
        .in("student_id", studentIds)
        .eq("institute_id", institute.id),
    ]);

    const firstHistoryError =
      attendanceRows.error ?? auditRows.error ?? feeRows.error;

    if (firstHistoryError) {
      historyLookupFailed = true;
      console.error("student history lookup failed", firstHistoryError);
    } else {
      for (const row of attendanceRows.data ?? []) {
        historicalStudentIds.add(row.student_id);
      }

      for (const row of auditRows.data ?? []) {
        historicalStudentIds.add(row.student_id);
      }

      for (const row of feeRows.data ?? []) {
        historicalStudentIds.add(row.student_id);
      }
    }
  }

  const filterParams = {
    branchId: branchScope.selectedBranchId,
    q: searchTerm,
    recordState:
      selectedRecordState === "active" ? undefined : selectedRecordState,
    status: selectedStatus,
  };
  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedStatus ||
      selectedRecordState !== "active" ||
      branchScope.selectedBranchId,
  );

  return (
    <DashboardShell
      activePage="students"
      instituteName={institute.name}
      role={role}
      title="Students"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find students</CardTitle>
            <CardDescription>
              Search by student name, student phone, or parent phone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3">
              <div
                className={
                  branchScope.showOwnerBranchFilter
                    ? "grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-4"
                    : "grid min-w-0 gap-4 lg:grid-cols-3"
                }
              >
                <Label className="min-w-0">
                  Search
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Name or phone"
                  />
                </Label>
                {branchScope.showOwnerBranchFilter ? (
                  <Label className="min-w-0">
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
                <Label className="min-w-0">
                  Status
                  <select
                    name="status"
                    defaultValue={selectedStatus}
                    className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Label>
                <Label className="min-w-0">
                  Records
                  <select
                    name="recordState"
                    defaultValue={selectedRecordState}
                    className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="active">Active students</option>
                    <option value="archived">Archived students</option>
                    <option value="all">All students</option>
                  </select>
                </Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Filtering..."
                >
                  <Search aria-hidden="true" data-icon="inline-start" />
                  Filter
                </SubmitButton>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/dashboard/students">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ActionMessage
          error={
            studentsError
              ? "Student records are unavailable right now. Please try again."
              : null
          }
        />

        <div
          className={
            canManageStudents
              ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
              : "grid gap-6"
          }
        >
          {canCreateStudents ? (
            <Card id="add-student">
              <CardHeader>
                <CardTitle className="text-xl">Add student</CardTitle>
                <CardDescription>
                  Add a student profile for batches, attendance, and fee
                  records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createStudent} className="grid gap-4">
                  {context.branchScope === "all" &&
                  accessibleBranches.length > 1 ? (
                    <Label>
                      Branch
                      <select
                        required
                        name="branchId"
                        defaultValue={branchScope.selectedBranchId ?? ""}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                      >
                        <option value="">Select branch</option>
                        {accessibleBranches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </Label>
                  ) : branchScope.selectedBranchId ? (
                    <input
                      name="branchId"
                      type="hidden"
                      value={branchScope.selectedBranchId}
                    />
                  ) : null}
                  <Label>
                    Full name
                    <Input
                      required
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      placeholder="Full student name"
                    />
                  </Label>
                  <Label>
                    Student phone
                    <Input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="Optional phone number"
                    />
                  </Label>
                  <Label>
                    Parent phone
                    <Input
                      name="parentPhone"
                      type="tel"
                      autoComplete="tel"
                      placeholder="Optional parent phone"
                    />
                  </Label>
                  <SubmitButton className="mt-1" pendingLabel="Creating...">
                    Create student
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Student records</CardTitle>
              <CardDescription>
                {getPageSummary({
                  page,
                  shownCount: students.length,
                  totalCount: totalStudents,
                })}{" "}
                in {branchScope.selectedBranchName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {students.length ? (
                <div className="grid gap-4">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {students.map((student) => {
                      const canDeleteStudent =
                        role === "owner" ||
                        (Boolean(student.branch_id) &&
                          canAccessPermission(context, "students.delete", {
                            branchId: student.branch_id,
                          }));
                      const canReactivateStudent =
                        Boolean(student.archived_at) &&
                        (role === "owner" ||
                          (Boolean(student.branch_id) &&
                            canAccessPermission(context, "students.update", {
                              branchId: student.branch_id,
                            })));
                      const hasHistoricalRecords =
                        historyLookupFailed ||
                        historicalStudentIds.has(student.id);
                      const canArchiveStudent =
                        canDeleteStudent && !student.archived_at;
                      const canHardDeleteStudent =
                        canDeleteStudent &&
                        !student.archived_at &&
                        !hasHistoricalRecords;

                      return (
                        <article key={student.id} className="grid gap-4 p-4">
                          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <h3 className="break-words text-lg font-semibold leading-tight text-foreground">
                                {student.full_name}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                                <span className="whitespace-nowrap">
                                  Student:{" "}
                                  {getContactValue(student.phone) ??
                                    "Not added"}
                                </span>
                                <span className="whitespace-nowrap">
                                  {getContactValue(student.phone) &&
                                  getContactValue(student.parent_phone) ? (
                                    <span
                                      aria-hidden="true"
                                      className="hidden text-muted-foreground/60 sm:inline"
                                    >
                                      |{" "}
                                    </span>
                                  ) : null}
                                  Parent:{" "}
                                  {getContactValue(student.parent_phone) ??
                                    "Not added"}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-start justify-start gap-2 xl:justify-end">
                              <Badge
                                variant={
                                  student.archived_at ||
                                  student.status === "inactive"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {student.archived_at
                                  ? "Archived"
                                  : getStatusLabel(student.status)}
                              </Badge>
                              <Badge variant="outline">
                                {branchesById.get(student.branch_id)?.name ??
                                  "Branch"}
                              </Badge>
                              <Button asChild size="sm" variant="outline">
                                <Link
                                  href={`/dashboard/students/${student.id}`}
                                >
                                  <Eye
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                  />
                                  View profile
                                </Link>
                              </Button>
                              {canReactivateStudent ? (
                                <form action={reactivateStudent}>
                                  <input
                                    name="studentId"
                                    type="hidden"
                                    value={student.id}
                                  />
                                  <SubmitButton
                                    pendingLabel="Reactivating..."
                                    size="sm"
                                    variant="outline"
                                  >
                                    <RotateCcw
                                      aria-hidden="true"
                                      data-icon="inline-start"
                                    />
                                    Reactivate
                                  </SubmitButton>
                                </form>
                              ) : null}
                              {canArchiveStudent && hasHistoricalRecords ? (
                                <form action={archiveStudent}>
                                  <input
                                    name="studentId"
                                    type="hidden"
                                    value={student.id}
                                  />
                                  <ConfirmSubmitButton
                                    type="submit"
                                    variant="outline"
                                    size="sm"
                                    confirmMessage={`Archive ${student.full_name}? This keeps attendance and fee history intact while removing the student from active lists.`}
                                    confirmTitle="Archive student?"
                                    confirmDescription="This student has historical records. Archiving keeps attendance and fee history intact while removing the student from active lists."
                                    confirmLabel="Archive student"
                                    pendingLabel="Archiving..."
                                  >
                                    <Archive
                                      aria-hidden="true"
                                      data-icon="inline-start"
                                    />
                                    Archive
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                              {canHardDeleteStudent ? (
                                <form action={deleteStudent}>
                                  <input
                                    name="studentId"
                                    type="hidden"
                                    value={student.id}
                                  />
                                  <ConfirmSubmitButton
                                    type="submit"
                                    variant="destructive"
                                    size="sm"
                                    confirmMessage={`Delete ${student.full_name}? This permanently removes the student record.`}
                                    confirmTitle="Delete student?"
                                    confirmDescription="This will permanently delete this student. This action cannot be undone."
                                    confirmLabel="Delete student"
                                    pendingLabel="Deleting..."
                                  >
                                    <Trash2
                                      aria-hidden="true"
                                      data-icon="inline-start"
                                    />
                                    Delete
                                  </ConfirmSubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </div>

                          {canUpdateStudents && !student.archived_at ? (
                            <details className="rounded-md border border-border bg-muted/30 p-3">
                              <summary className="cursor-pointer text-sm font-medium">
                                Edit student
                              </summary>
                              <form
                                action={updateStudent}
                                className="mt-4 grid gap-3 sm:grid-cols-2"
                              >
                                <input
                                  name="studentId"
                                  type="hidden"
                                  value={student.id}
                                />
                                <Label>
                                  Full name
                                  <Input
                                    required
                                    name="fullName"
                                    type="text"
                                    defaultValue={student.full_name}
                                    autoComplete="name"
                                  />
                                </Label>
                                <Label>
                                  Student phone
                                  <Input
                                    name="phone"
                                    type="tel"
                                    defaultValue={student.phone ?? ""}
                                    autoComplete="tel"
                                  />
                                </Label>
                                <Label>
                                  Parent phone
                                  <Input
                                    name="parentPhone"
                                    type="tel"
                                    defaultValue={student.parent_phone ?? ""}
                                    autoComplete="tel"
                                  />
                                </Label>
                                <Label>
                                  Status
                                  <select
                                    name="status"
                                    defaultValue={student.status ?? "active"}
                                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                                  >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                  </select>
                                </Label>
                                <SubmitButton
                                  className="sm:col-span-2 sm:w-fit"
                                  pendingLabel="Updating..."
                                >
                                  <Save
                                    aria-hidden="true"
                                    data-icon="inline-start"
                                  />
                                  Save changes
                                </SubmitButton>
                              </form>
                            </details>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/students"
                    page={page}
                    pageSize={defaultPageSize}
                    params={filterParams}
                    totalCount={totalStudents}
                  />
                </div>
              ) : (
                <EmptyState
                  actionHref={
                    !hasActiveFilters && canCreateStudents
                      ? "/dashboard/students#add-student"
                      : undefined
                  }
                  actionLabel="Add student"
                  title={
                    hasActiveFilters
                      ? "No students match these filters"
                      : "No students added yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Adjust your search, branch, or status filters to find student records."
                      : "Add your first student to begin managing batches, attendance, and fee records."
                  }
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardShell>
  );
}
