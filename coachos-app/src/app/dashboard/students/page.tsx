import { Save, Trash2 } from "lucide-react";

import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import {
  hasAnyPermission,
  hasPermission,
  requirePermission,
} from "@/lib/auth/permissions";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  createStudent,
  deleteStudent,
  updateStudent,
} from "@/lib/students/actions";

type StudentsPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
  }>;
};

type Student = {
  branch_id: string;
  id: string;
  full_name: string;
  phone: string | null;
  parent_phone: string | null;
  status: string | null;
};

export default async function StudentsPage({ searchParams }: StudentsPageProps) {
  const context = await requirePermission("students.view");
  const { accessibleBranches, supabase, claims, institute, role } = context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
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
    .select("id, branch_id, full_name, phone, parent_phone, status")
    .eq("institute_id", institute.id)
    .order("created_at", { ascending: false });

  if (branchScope.selectedBranchId) {
    studentsQuery = studentsQuery.eq("branch_id", branchScope.selectedBranchId);
  } else if (branchScope.visibleBranchIds.length) {
    studentsQuery = studentsQuery.in("branch_id", branchScope.visibleBranchIds);
  }

  const { data: students } = await studentsQuery;

  return (
    <DashboardShell
      activePage="students"
      instituteName={institute.name}
      role={role}
      title="Students"
      userEmail={claims.email}
    >
      <section className="grid gap-6">
        {branchScope.showOwnerBranchFilter ? (
          <BranchFilter
            branches={accessibleBranches}
            selectedBranchId={branchScope.selectedBranchId}
          />
        ) : null}

        <div
          className={
            canManageStudents
              ? "grid gap-6 lg:grid-cols-[360px_1fr]"
              : "grid gap-6"
          }
        >
        {canCreateStudents ? (
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Add student
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a basic student record for this institute.
              </p>
            </div>

            {params.error ? (
              <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {params.error}
              </p>
            ) : null}

            <form action={createStudent} className="mt-5 grid gap-4">
              {context.branchScope === "all" &&
              accessibleBranches.length > 1 ? (
                <label className="grid gap-2 text-sm font-medium">
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
                </label>
              ) : branchScope.selectedBranchId ? (
                <input
                  name="branchId"
                  type="hidden"
                  value={branchScope.selectedBranchId}
                />
              ) : null}
              <label className="grid gap-2 text-sm font-medium">
                Full name
                <input
                  required
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="Student name"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Student phone
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="Optional"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Parent phone
                <input
                  name="parentPhone"
                  type="tel"
                  autoComplete="tel"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  placeholder="Optional"
                />
              </label>
              <Button type="submit" className="mt-1">
                Create student
              </Button>
            </form>
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="text-xl font-semibold tracking-tight">
              Students list
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Manage student records for this institute.
            </p>
          </div>

          {students?.length ? (
            <div className="divide-y divide-border">
              {(students as Student[]).map((student) => (
                <article
                  key={student.id}
                  className="grid gap-4 p-5"
                >
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div>
                      <h3 className="font-medium">{student.full_name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Student: {student.phone ?? "Not added"} | Parent:{" "}
                        {student.parent_phone ?? "Not added"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="h-fit rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {student.status ?? "active"}
                      </span>
                      <span className="h-fit rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {branchesById.get(student.branch_id)?.name ??
                          "Branch"}
                      </span>
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
                          >
                            <Trash2 aria-hidden="true" data-icon="inline-start" />
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
                        <label className="grid gap-2 text-sm font-medium">
                          Full name
                          <input
                            required
                            name="fullName"
                            type="text"
                            defaultValue={student.full_name}
                            autoComplete="name"
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Student phone
                          <input
                            name="phone"
                            type="tel"
                            defaultValue={student.phone ?? ""}
                            autoComplete="tel"
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Parent phone
                          <input
                            name="parentPhone"
                            type="tel"
                            defaultValue={student.parent_phone ?? ""}
                            autoComplete="tel"
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                          />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                          Status
                          <select
                            name="status"
                            defaultValue={student.status ?? "active"}
                            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </label>
                        <Button type="submit" className="sm:col-span-2 sm:w-fit">
                          <Save aria-hidden="true" data-icon="inline-start" />
                          Save changes
                        </Button>
                      </form>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-muted-foreground">
                No students yet. Add the first student using the form.
              </p>
            </div>
          )}
        </div>
        </div>
      </section>
    </DashboardShell>
  );
}
