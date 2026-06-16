import { Eye, Plus, Save, Search, Trash2, UserMinus, UserPlus } from "lucide-react";
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
  hasAnyPermission,
  hasPermission,
  requirePermission,
  type DashboardContext,
} from "@/lib/auth/permissions";
import {
  assignStudentToBatch,
  assignTeacherToBatch,
  createBatch,
  deleteBatch,
  removeTeacherFromBatch,
  updateBatch,
} from "@/lib/batches/actions";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  defaultPageSize,
  getPage,
  getPageSummary,
  getPaginationRange,
  getSearchTerm,
} from "@/lib/dashboard/list-controls";

type BatchesPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
    page?: string;
    q?: string;
    subject?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Batches",
};

type Batch = {
  branch_id: string;
  id: string;
  name: string;
  subject: string | null;
  schedule: string | null;
  created_at: string | null;
};

type Student = {
  branch_id: string;
  id: string;
  full_name: string;
  phone: string | null;
};

type StudentBatch = {
  id: string;
  student_id: string;
  batch_id: string;
  created_at: string | null;
};

type TeacherMembership = {
  branch_id: string;
  id: string;
  role: string;
  user_id: string;
};

type StaffTeacher = {
  auth_user_id: string | null;
  branch_id: string | null;
  email: string;
  full_name: string;
  role: string;
};

type BatchTeacher = {
  batch_id: string;
  created_at: string | null;
  id: string;
  membership_id: string;
};

function canManageTeacherAssignmentsForBranch(
  context: Pick<DashboardContext, "accessibleBranches" | "memberships">,
  branchId: string,
) {
  return context.memberships.some((membership) => {
    if (membership.role === "owner") {
      return context.accessibleBranches.some((branch) => branch.id === branchId);
    }

    return (
      membership.role === "branch_manager" && membership.branch_id === branchId
    );
  });
}

function getBatchesWithStudents(
  batches: Batch[],
  students: Student[],
  studentBatches: StudentBatch[],
) {
  const studentsById = new Map(
    students.map((student) => [student.id, student]),
  );
  const studentsByBatchId = new Map<string, Student[]>();

  for (const studentBatch of studentBatches) {
    const student = studentsById.get(studentBatch.student_id);

    if (!student) {
      continue;
    }

    const batchStudents = studentsByBatchId.get(studentBatch.batch_id) ?? [];
    batchStudents.push(student);
    studentsByBatchId.set(studentBatch.batch_id, batchStudents);
  }

  return batches.map((batch) => ({
    ...batch,
    students: (studentsByBatchId.get(batch.id) ?? []).sort((first, second) =>
      first.full_name.localeCompare(second.full_name),
    ),
  }));
}

function getTeacherLabel(
  teacherMembership: TeacherMembership,
  staffByAuthUserId: Map<string, StaffTeacher>,
) {
  const staffTeacher = staffByAuthUserId.get(teacherMembership.user_id);

  if (!staffTeacher) {
    return "Linked teacher";
  }

  return staffTeacher.email
    ? `${staffTeacher.full_name} | ${staffTeacher.email}`
    : staffTeacher.full_name;
}

export default async function BatchesPage({ searchParams }: BatchesPageProps) {
  const context = await requirePermission("batches.view");
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedSubject = String(params.subject ?? "").trim();
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const canCreateBatches = hasPermission(role, "batches.create");
  const canUpdateBatches = hasPermission(role, "batches.update");
  const canDeleteBatches = hasPermission(role, "batches.delete");
  const canManageAnyTeacherAssignments = context.memberships.some(
    (membership) =>
      membership.role === "owner" || membership.role === "branch_manager",
  );
  const canManageBatches = hasAnyPermission(role, [
    "batches.create",
    "batches.update",
    "batches.delete",
  ]);

  let batchesQuery = supabase
    .from("batches")
    .select("id, branch_id, name, subject, schedule, created_at", {
      count: "exact",
    })
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });
  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone")
    .eq("institute_id", institute.id)
    .order("full_name", { ascending: true });
  let subjectsQuery = supabase
    .from("batches")
    .select("subject")
    .eq("institute_id", institute.id)
    .not("subject", "is", null)
    .order("subject", { ascending: true });

  if (branchScope.selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", branchScope.selectedBranchId);
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
    subjectsQuery = subjectsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", branchScope.visibleBranchIds);
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
    subjectsQuery = subjectsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    batchesQuery = batchesQuery.or(
      `name.ilike.${searchPattern},subject.ilike.${searchPattern}`,
    );
  }

  if (selectedSubject) {
    batchesQuery = batchesQuery.eq("subject", selectedSubject);
  }

  const [batchesResponse, studentsResponse, subjectsResponse] =
    await Promise.all([
      batchesQuery.range(paginationRange.from, paginationRange.to),
      studentsQuery,
      subjectsQuery,
    ]);

  const batches = (batchesResponse.data ?? []) as Batch[];
  const students = (studentsResponse.data ?? []) as Student[];
  const totalBatches = batchesResponse.count ?? 0;
  const subjectOptions = Array.from(
    new Set(
      ((subjectsResponse.data ?? []) as { subject: string | null }[])
        .map((row) => row.subject?.trim())
        .filter((subject): subject is string => Boolean(subject)),
    ),
  );
  const batchIds = batches.map((batch) => batch.id);
  let studentBatches: StudentBatch[] = [];
  let studentBatchesError: unknown = null;
  let teacherMemberships: TeacherMembership[] = [];
  let staffTeachers: StaffTeacher[] = [];
  let batchTeachers: BatchTeacher[] = [];
  let teacherAssignmentError = false;

  if (batchIds.length) {
    const { data: studentBatchRows, error } = await supabase
      .from("student_batches")
      .select("id, student_id, batch_id, created_at")
      .in("batch_id", batchIds)
      .order("created_at", { ascending: true });

    studentBatches = (studentBatchRows ?? []) as StudentBatch[];
    studentBatchesError = error;
  }

  if (canManageAnyTeacherAssignments && batchIds.length) {
    let teacherMembershipsQuery = supabase
      .from("memberships")
      .select("id, user_id, branch_id, role")
      .eq("institute_id", institute.id)
      .eq("role", "teacher")
      .not("branch_id", "is", null)
      .order("created_at", { ascending: true });

    if (branchScope.selectedBranchId) {
      teacherMembershipsQuery = teacherMembershipsQuery.eq(
        "branch_id",
        branchScope.selectedBranchId,
      );
    } else if (branchScope.visibleBranchIds.length) {
      teacherMembershipsQuery = teacherMembershipsQuery.in(
        "branch_id",
        branchScope.visibleBranchIds,
      );
    }

    const [teacherMembershipsResponse, batchTeachersResponse] =
      await Promise.all([
        teacherMembershipsQuery,
        supabase
          .from("batch_teachers")
          .select("id, batch_id, membership_id, created_at")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: true }),
      ]);

    teacherMemberships = (teacherMembershipsResponse.data ??
      []) as TeacherMembership[];
    batchTeachers = (batchTeachersResponse.data ?? []) as BatchTeacher[];
    teacherAssignmentError = Boolean(
      teacherMembershipsResponse.error ?? batchTeachersResponse.error,
    );

    const teacherUserIds = teacherMemberships.map(
      (teacherMembership) => teacherMembership.user_id,
    );

    if (teacherUserIds.length) {
      const { data: staffTeacherRows, error: staffTeachersError } =
        await supabase
          .from("staff_members")
          .select("auth_user_id, branch_id, full_name, email, role")
          .eq("institute_id", institute.id)
          .eq("role", "teacher")
          .in("auth_user_id", teacherUserIds);

      staffTeachers = (staffTeacherRows ?? []) as StaffTeacher[];
      teacherAssignmentError =
        teacherAssignmentError || Boolean(staffTeachersError);
    }
  }

  const teacherMembershipsById = new Map(
    teacherMemberships.map((teacherMembership) => [
      teacherMembership.id,
      teacherMembership,
    ]),
  );
  const staffTeachersByAuthUserId = new Map(
    staffTeachers
      .filter((staffTeacher) => staffTeacher.auth_user_id)
      .map((staffTeacher) => [staffTeacher.auth_user_id as string, staffTeacher]),
  );
  const batchTeachersByBatchId = new Map<string, BatchTeacher[]>();

  for (const batchTeacher of batchTeachers) {
    const teacherAssignments =
      batchTeachersByBatchId.get(batchTeacher.batch_id) ?? [];
    teacherAssignments.push(batchTeacher);
    batchTeachersByBatchId.set(batchTeacher.batch_id, teacherAssignments);
  }

  const batchesWithStudents = getBatchesWithStudents(
    batches,
    students,
    studentBatches,
  );
  const queryError = Boolean(
    batchesResponse.error ??
      studentsResponse.error ??
      subjectsResponse.error ??
      studentBatchesError ??
      teacherAssignmentError,
  );
  const filterParams = {
    branchId: branchScope.selectedBranchId,
    q: searchTerm,
    subject: selectedSubject,
  };
  const hasActiveFilters = Boolean(
    searchTerm || selectedSubject || branchScope.selectedBranchId,
  );

  return (
    <DashboardShell
      activePage="batches"
      instituteName={institute.name}
      role={role}
      title="Batches"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find batches</CardTitle>
            <CardDescription>
              Search by batch name or subject, then narrow by branch or subject.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3">
              <div
                className={
                  branchScope.showOwnerBranchFilter
                    ? "grid min-w-0 gap-4 lg:grid-cols-2 xl:grid-cols-3"
                    : "grid min-w-0 gap-4 lg:grid-cols-2"
                }
              >
                <Label className="min-w-0">
                  Search
                  <Input
                    className="box-border h-10 w-full min-w-0"
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Batch name or subject"
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
                  Subject
                  <select
                    name="subject"
                    defaultValue={selectedSubject}
                    className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All subjects</option>
                    {subjectOptions.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
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
                  <Link href="/dashboard/batches">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ActionMessage
          error={
            queryError
              ? "Batch records are unavailable right now. Please try again."
              : null
          }
        />

        <div
          className={
            canManageBatches
              ? "grid min-w-0 gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
              : "grid gap-6"
          }
        >
          {canCreateBatches ? (
            <Card id="create-batch">
              <CardHeader>
                <CardTitle className="text-xl">Create batch</CardTitle>
                <CardDescription>
                  Group students by subject, schedule, or class section.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createBatch} className="grid gap-4">
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
                    Batch name
                    <Input
                      required
                      name="name"
                      type="text"
                      autoComplete="off"
                      placeholder="Grade 10 Morning"
                    />
                  </Label>
                  <Label>
                    Subject
                    <Input
                      name="subject"
                      type="text"
                      autoComplete="off"
                      placeholder="Mathematics"
                    />
                  </Label>
                  <Label>
                    Schedule
                    <Input
                      name="schedule"
                      type="text"
                      autoComplete="off"
                      placeholder="Mon, Wed, Fri - 7:00 AM"
                    />
                  </Label>
                  <SubmitButton className="mt-1" pendingLabel="Creating...">
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Create batch
                  </SubmitButton>
                </form>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  Batch records
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getPageSummary({
                    page,
                    shownCount: batches.length,
                    totalCount: totalBatches,
                  })}{" "}
                  in {branchScope.selectedBranchName}
                </p>
              </div>
              <Badge variant="outline">
                {students.length}{" "}
                {students.length === 1 ? "student" : "students"}
              </Badge>
            </div>

            {batchesWithStudents.length ? (
              <div className="grid gap-4">
                {batchesWithStudents.map((batch) => {
                const assignedStudentIds = new Set(
                  batch.students.map((student) => student.id),
                );
                const availableStudents = students.filter(
                  (student) =>
                    student.branch_id === batch.branch_id &&
                    !assignedStudentIds.has(student.id),
                );
                const assignedTeacherRows =
                  batchTeachersByBatchId.get(batch.id) ?? [];
                const assignedTeacherMembershipIds = new Set(
                  assignedTeacherRows.map(
                    (batchTeacher) => batchTeacher.membership_id,
                  ),
                );
                const assignedTeachers = assignedTeacherRows
                  .map((batchTeacher) => {
                    const teacherMembership = teacherMembershipsById.get(
                      batchTeacher.membership_id,
                    );

                    if (!teacherMembership) {
                      return null;
                    }

                    return {
                      assignmentId: batchTeacher.id,
                      label: getTeacherLabel(
                        teacherMembership,
                        staffTeachersByAuthUserId,
                      ),
                      membershipId: teacherMembership.id,
                    };
                  })
                  .filter(
                    (
                      teacher,
                    ): teacher is {
                      assignmentId: string;
                      label: string;
                      membershipId: string;
                    } => Boolean(teacher),
                  );
                const availableTeachers = teacherMemberships.filter(
                  (teacherMembership) =>
                    teacherMembership.branch_id === batch.branch_id &&
                    !assignedTeacherMembershipIds.has(teacherMembership.id),
                );
                const canManageTeacherAssignments =
                  canManageTeacherAssignmentsForBranch(context, batch.branch_id);

                  return (
                    <Card key={batch.id}>
                    <CardHeader className="flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold leading-tight text-foreground">
                          {batch.name}
                        </h3>
                        <CardDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="whitespace-nowrap">
                            {batch.subject ?? "Subject not specified"}
                          </span>
                          {batch.schedule ? (
                            <span className="whitespace-nowrap">
                              <span
                                aria-hidden="true"
                                className="hidden text-muted-foreground/60 sm:inline"
                              >
                                |{" "}
                              </span>
                              {batch.schedule}
                            </span>
                          ) : null}
                        </CardDescription>
                      </div>
                      <div className="flex w-full flex-wrap items-start justify-start gap-2 sm:justify-end 2xl:w-auto 2xl:shrink-0">
                        <Badge variant="secondary">
                          {batch.students.length}{" "}
                          {batch.students.length === 1
                            ? "student"
                            : "students"}
                        </Badge>
                        {canManageTeacherAssignments ? (
                          <Badge variant="outline">
                            {assignedTeachers.length}{" "}
                            {assignedTeachers.length === 1
                              ? "teacher"
                              : "teachers"}
                          </Badge>
                        ) : null}
                        <Badge variant="outline">
                          {branchesById.get(batch.branch_id)?.name ?? "Branch"}
                        </Badge>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/dashboard/batches/${batch.id}`}>
                            <Eye aria-hidden="true" data-icon="inline-start" />
                            View details
                          </Link>
                        </Button>
                        {canDeleteBatches ? (
                          <form action={deleteBatch}>
                            <input
                              type="hidden"
                              name="batchId"
                              value={batch.id}
                            />
                            <ConfirmSubmitButton
                              type="submit"
                              variant="destructive"
                              size="sm"
                              confirmMessage={`Delete ${batch.name}? This also removes student assignments and attendance records for this batch.`}
                              confirmTitle="Delete batch?"
                              confirmDescription={`This will remove ${batch.name}, including student assignments and attendance records for this batch. This action cannot be undone.`}
                              confirmLabel="Delete batch"
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
                    </CardHeader>
                    <CardContent className="grid gap-5">
                      <div>
                        {batch.students.length ? (
                          <ul className="divide-y divide-border rounded-md border border-border">
                            {batch.students.map((student) => (
                              <li
                                key={student.id}
                                className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <span className="text-sm font-medium">
                                  {student.full_name}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {student.phone ?? "Phone not added"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <EmptyState
                            title="No students assigned"
                            description="Assign students to this batch to organize schedules and attendance."
                          />
                        )}
                      </div>

                      {canManageTeacherAssignments ? (
                        <div className="grid gap-3 rounded-md border border-border bg-muted/20 p-3">
                          <div>
                            <p className="text-sm font-medium">Teachers</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Assign teacher staff members from this batch
                              branch.
                            </p>
                          </div>

                          {assignedTeachers.length ? (
                            <ul className="divide-y divide-border rounded-md border border-border bg-background">
                              {assignedTeachers.map((teacher) => (
                                <li
                                  key={teacher.assignmentId}
                                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <span className="text-sm font-medium">
                                    {teacher.label}
                                  </span>
                                  <form action={removeTeacherFromBatch}>
                                    <input
                                      name="batchTeacherId"
                                      type="hidden"
                                      value={teacher.assignmentId}
                                    />
                                    <ConfirmSubmitButton
                                      type="submit"
                                      variant="outline"
                                      size="sm"
                                      pendingLabel="Removing..."
                                      confirmMessage={`Remove ${teacher.label} from ${batch.name}?`}
                                      confirmTitle="Remove teacher?"
                                      confirmDescription={`This will remove ${teacher.label} from ${batch.name}. The staff member and other batch assignments remain unchanged.`}
                                      confirmLabel="Remove teacher"
                                      destructive={false}
                                    >
                                      <UserMinus
                                        aria-hidden="true"
                                        data-icon="inline-start"
                                      />
                                      Remove
                                    </ConfirmSubmitButton>
                                  </form>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <EmptyState
                              title="No teachers assigned"
                              description="Assign teacher staff members from this branch when they are available."
                            />
                          )}

                          <form
                            action={assignTeacherToBatch}
                            className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <input
                              type="hidden"
                              name="batchId"
                              value={batch.id}
                            />
                            <Label className="min-w-0">
                              Add teacher
                              <select
                                required
                                name="membershipId"
                                disabled={!availableTeachers.length}
                                className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">
                                  {availableTeachers.length
                                    ? "Select teacher"
                                    : "No teacher staff members available in this branch"}
                                </option>
                                {availableTeachers.map((teacherMembership) => (
                                  <option
                                    key={teacherMembership.id}
                                    value={teacherMembership.id}
                                  >
                                    {getTeacherLabel(
                                      teacherMembership,
                                      staffTeachersByAuthUserId,
                                    )}
                                  </option>
                                ))}
                              </select>
                            </Label>
                            <SubmitButton
                              variant="outline"
                              className="self-end"
                              disabled={!availableTeachers.length}
                              pendingLabel="Assigning..."
                            >
                              <UserPlus
                                aria-hidden="true"
                                data-icon="inline-start"
                              />
                              Assign
                            </SubmitButton>
                          </form>
                        </div>
                      ) : null}

                      {canUpdateBatches ? (
                        <>
                          <details className="rounded-md border border-border bg-muted/30 p-3">
                            <summary className="cursor-pointer text-sm font-medium">
                              Edit batch
                            </summary>
                            <form
                              action={updateBatch}
                              className="mt-4 grid gap-3 sm:grid-cols-3"
                            >
                              <input
                                type="hidden"
                                name="batchId"
                                value={batch.id}
                              />
                              <Label>
                                Batch name
                                <Input
                                  required
                                  name="name"
                                  type="text"
                                  defaultValue={batch.name}
                                  autoComplete="off"
                                />
                              </Label>
                              <Label>
                                Subject
                                <Input
                                  name="subject"
                                  type="text"
                                  defaultValue={batch.subject ?? ""}
                                  autoComplete="off"
                                />
                              </Label>
                              <Label>
                                Schedule
                                <Input
                                  name="schedule"
                                  type="text"
                                  defaultValue={batch.schedule ?? ""}
                                  autoComplete="off"
                                />
                              </Label>
                              <SubmitButton
                                className="sm:col-span-3 sm:w-fit"
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

                          <form
                            action={assignStudentToBatch}
                            className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <input
                              type="hidden"
                              name="batchId"
                              value={batch.id}
                            />
                            <label className="grid min-w-0 gap-2 text-sm font-medium">
                              Add student
                              <select
                                required
                                name="studentId"
                                disabled={!availableStudents.length}
                                className="box-border h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">
                                  {availableStudents.length
                                    ? "Select student"
                                    : "All branch students added"}
                                </option>
                                {availableStudents.map((student) => (
                                  <option key={student.id} value={student.id}>
                                    {student.full_name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <SubmitButton
                              variant="outline"
                              className="self-end"
                              disabled={!availableStudents.length}
                              pendingLabel="Assigning..."
                            >
                              <UserPlus
                                aria-hidden="true"
                                data-icon="inline-start"
                              />
                              Add
                            </SubmitButton>
                          </form>
                        </>
                      ) : null}
                    </CardContent>
                  </Card>
                  );
                })}
                <PaginationControls
                  basePath="/dashboard/batches"
                  page={page}
                  pageSize={defaultPageSize}
                  params={filterParams}
                  totalCount={totalBatches}
                />
              </div>
              ) : (
                <Card>
                  <CardContent className="pt-5">
                    <EmptyState
                      actionHref={
                        !hasActiveFilters && canCreateBatches
                          ? "/dashboard/batches#create-batch"
                          : undefined
                      }
                      actionLabel="Create batch"
                      title={
                        hasActiveFilters
                          ? "No batches match these filters"
                          : "No batches created yet"
                      }
                      description={
                        hasActiveFilters
                          ? "Adjust your search, branch, or subject filters to find batch records."
                          : "Create a batch to organize students, schedules, and attendance."
                      }
                    />
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
