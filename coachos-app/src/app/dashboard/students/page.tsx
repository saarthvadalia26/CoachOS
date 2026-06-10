import { Eye, Save, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  defaultPageSize,
  getPage,
  getPageSummary,
  getPaginationRange,
  getSearchTerm,
} from "@/lib/dashboard/list-controls";
import {
  createStudent,
  deleteStudent,
  updateStudent,
} from "@/lib/students/actions";

type StudentsPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
    page?: string;
    q?: string;
    status?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Students",
};

type Student = {
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

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const context = await requirePermission("students.view");
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedStatus = getSelectedStatus(params.status);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const canCreateStudents = hasPermission(role, "students.create");
  const canUpdateStudents = hasPermission(role, "students.update");
  const canDeleteStudents = hasPermission(role, "students.delete");
  const canManageStudents = hasAnyPermission(role, [
    "students.create",
    "students.update",
    "students.delete",
  ]);

  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone, parent_phone, status", {
      count: "exact",
    })
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

  const { data: studentRows, count: studentsCount, error: studentsError } =
    await studentsQuery.range(paginationRange.from, paginationRange.to);
  const students = (studentRows ?? []) as Student[];
  const totalStudents = studentsCount ?? 0;
  const filterParams = {
    branchId: branchScope.selectedBranchId,
    q: searchTerm,
    status: selectedStatus,
  };
  const hasActiveFilters = Boolean(
    searchTerm || selectedStatus || branchScope.selectedBranchId,
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
                    ? "grid gap-3 md:grid-cols-3"
                    : "grid gap-3 md:grid-cols-2"
                }
              >
                <Label>
                  Search
                  <Input
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Name or phone"
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
                  Status
                  <select
                    name="status"
                    defaultValue={selectedStatus}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
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
            params.error ??
            (studentsError
              ? "Student records are unavailable right now. Please try again."
              : null)
          }
          success={params.success}
        />

        <div
          className={
            canManageStudents
              ? "grid gap-6 lg:grid-cols-[360px_1fr]"
              : "grid gap-6"
          }
        >
          {canCreateStudents ? (
            <Card>
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
                    {students.map((student) => (
                      <article key={student.id} className="grid gap-4 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate text-base font-semibold tracking-tight">
                              {student.full_name}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Student: {student.phone ?? "Not added"} | Parent:{" "}
                              {student.parent_phone ?? "Not added"}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-start gap-2 sm:justify-end">
                            <Badge
                              variant={
                                student.status === "inactive"
                                  ? "outline"
                                  : "secondary"
                              }
                            >
                              {getStatusLabel(student.status)}
                            </Badge>
                            <Badge variant="outline">
                              {branchesById.get(student.branch_id)?.name ??
                                "Branch"}
                            </Badge>
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/dashboard/students/${student.id}`}>
                                <Eye
                                  aria-hidden="true"
                                  data-icon="inline-start"
                                />
                                View profile
                              </Link>
                            </Button>
                            {canDeleteStudents ? (
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
                                  confirmMessage={`Delete ${student.full_name}? This also removes batch relationships, attendance records, and fee records for this student.`}
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

                        {canUpdateStudents ? (
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
                    ))}
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
                <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                  {hasActiveFilters
                    ? "No records match the selected filters."
                    : "No students have been added yet. Add your first student to begin."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </DashboardShell>
  );
}
