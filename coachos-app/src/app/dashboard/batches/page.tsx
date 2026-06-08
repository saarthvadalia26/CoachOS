import { Plus, Save, Trash2, UserMinus, UserPlus } from "lucide-react";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
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

type BatchesPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
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
    .select("id, branch_id, name, subject, schedule, created_at")
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });
  let studentsQuery = supabase
    .from("students")
    .select("id, branch_id, full_name, phone")
    .eq("institute_id", institute.id)
    .order("full_name", { ascending: true });

  if (branchScope.selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", branchScope.selectedBranchId);
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", branchScope.visibleBranchIds);
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  const [batchesResponse, studentsResponse, studentBatchesResponse] =
    await Promise.all([
      batchesQuery,
      studentsQuery,
      supabase
        .from("student_batches")
        .select("id, student_id, batch_id, created_at")
        .order("created_at", { ascending: true }),
    ]);

  const batches = (batchesResponse.data ?? []) as Batch[];
  const students = (studentsResponse.data ?? []) as Student[];
  const studentBatches = (studentBatchesResponse.data ?? []) as StudentBatch[];
  let teacherMemberships: TeacherMembership[] = [];
  let staffTeachers: StaffTeacher[] = [];
  let batchTeachers: BatchTeacher[] = [];
  let teacherAssignmentError = false;

  if (canManageAnyTeacherAssignments) {
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
      studentBatchesResponse.error ??
      teacherAssignmentError,
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
        {branchScope.showOwnerBranchFilter ? (
          <BranchFilter
            branches={accessibleBranches}
            selectedBranchId={branchScope.selectedBranchId}
          />
        ) : null}

        <ActionMessage
          error={
            params.error ??
            (queryError
              ? "Batch records are unavailable right now. Please try again."
              : null)
          }
          success={params.success}
        />

        <div
          className={
            canManageBatches
              ? "grid gap-6 lg:grid-cols-[360px_1fr]"
              : "grid gap-6"
          }
        >
          {canCreateBatches ? (
            <Card>
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
                  {batches.length} {batches.length === 1 ? "batch" : "batches"}{" "}
                  in {branchScope.selectedBranchName}
                </p>
              </div>
              <Badge variant="outline">
                {students.length}{" "}
                {students.length === 1 ? "student" : "students"}
              </Badge>
            </div>

            {batchesWithStudents.length ? (
              batchesWithStudents.map((batch) => {
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
                    <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <CardTitle className="text-lg">{batch.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {batch.subject ?? "Subject not specified"}
                          {batch.schedule ? ` | ${batch.schedule}` : ""}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2 sm:justify-end">
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
                          <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                            No students are assigned to this batch yet.
                          </p>
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
                                    <SubmitButton
                                      variant="outline"
                                      size="sm"
                                      pendingLabel="Removing..."
                                    >
                                      <UserMinus
                                        aria-hidden="true"
                                        data-icon="inline-start"
                                      />
                                      Remove
                                    </SubmitButton>
                                  </form>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="rounded-md border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                              No teachers are assigned to this batch yet.
                            </p>
                          )}

                          <form
                            action={assignTeacherToBatch}
                            className="grid gap-3 sm:grid-cols-[1fr_auto]"
                          >
                            <input
                              type="hidden"
                              name="batchId"
                              value={batch.id}
                            />
                            <Label>
                              Add teacher
                              <select
                                required
                                name="membershipId"
                                disabled={!availableTeachers.length}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="grid gap-3 sm:grid-cols-[1fr_auto]"
                          >
                            <input
                              type="hidden"
                              name="batchId"
                              value={batch.id}
                            />
                            <label className="grid gap-2 text-sm font-medium">
                              Add student
                              <select
                                required
                                name="studentId"
                                disabled={!availableStudents.length}
                                className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50"
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
              })
            ) : (
              <Card>
                <CardContent className="pt-5">
                  <p className="text-sm text-muted-foreground">
                    No batches have been created yet. Create a batch to
                    organize students and schedules.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
