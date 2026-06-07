import { Save, Trash2, UserPlus } from "lucide-react";

import { BranchFilter } from "@/components/dashboard/BranchFilter";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
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
import {
  hasAnyPermission,
  requirePermission,
  staffRoles,
} from "@/lib/auth/permissions";
import { getBranchScope } from "@/lib/dashboard/branch-scope";
import {
  createStaffMember,
  deleteStaffMember,
  updateStaffMember,
} from "@/lib/staff/actions";

type StaffPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
  }>;
};

type StaffMember = {
  branch_id: string | null;
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: string;
  created_at: string | null;
};

function getRoleBadgeVariant(role: string) {
  if (role === "owner") {
    return "default";
  }

  if (role === "teacher" || role === "academic_coordinator") {
    return "secondary";
  }

  return "outline";
}

function getLinkStatusLabel(staffMember: Pick<StaffMember, "auth_user_id">) {
  return staffMember.auth_user_id ? "Linked" : "Pending account setup";
}

function getRoleLabel(role: string) {
  if (role === "branch_manager") {
    return "Branch Manager";
  }

  if (role === "operations_staff") {
    return "Operations Staff";
  }

  if (role === "accountant") {
    return "Accountant";
  }

  if (role === "academic_coordinator") {
    return "Academic Coordinator";
  }

  if (role === "teacher") {
    return "Teacher";
  }

  return role;
}

function RoleSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select
      required
      name="role"
      defaultValue={defaultValue ?? "teacher"}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
    >
      {staffRoles.map((role) => (
        <option key={role} value={role}>
          {getRoleLabel(role)}
        </option>
      ))}
    </select>
  );
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const context = await requirePermission("staff.view");
  const { accessibleBranches, supabase, claims, institute, role } = context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const branchesById = new Map(
    accessibleBranches.map((branch) => [branch.id, branch]),
  );
  const canManageStaff = hasAnyPermission(role, [
    "staff.create",
    "staff.update",
    "staff.delete",
  ]);

  const staffQuery = supabase
    .from("staff_members")
    .select("id, branch_id, auth_user_id, full_name, email, role, created_at")
    .neq("role", "owner")
    .order("created_at", { ascending: false });

  let scopedStaffQuery = staffQuery.eq("institute_id", institute.id);

  if (branchScope.selectedBranchId) {
    scopedStaffQuery = scopedStaffQuery.eq(
      "branch_id",
      branchScope.selectedBranchId,
    );
  } else if (branchScope.visibleBranchIds.length) {
    scopedStaffQuery = scopedStaffQuery.in(
      "branch_id",
      branchScope.visibleBranchIds,
    );
  }

  const { data: staffRows, error: staffError } = await scopedStaffQuery;

  const staffMembers = (staffRows ?? []) as StaffMember[];

  return (
    <DashboardShell
      activePage="staff"
      instituteName={institute.name}
      role={role}
      title="Staff"
      userEmail={claims.email}
    >
      <section className="grid gap-6">
        {branchScope.showOwnerBranchFilter ? (
          <BranchFilter
            branches={accessibleBranches}
            selectedBranchId={branchScope.selectedBranchId}
          />
        ) : null}

        {params.error || staffError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {params.error ??
              "Staff member records are unavailable right now. Please try again."}
          </p>
        ) : null}

        {!canManageStaff ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Restricted access</CardTitle>
              <CardDescription>
                You can view staff members in your branch. Staff management is
                available only to the institute owner.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {staffMembers.length ? (
                <div className="divide-y divide-border rounded-md border border-border">
                  {staffMembers.map((staffMember) => (
                    <article key={staffMember.id} className="grid gap-2 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{staffMember.full_name}</h2>
                        <Badge variant={getRoleBadgeVariant(staffMember.role)}>
                          {getRoleLabel(staffMember.role)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {staffMember.email}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No staff members are available for your branch.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Add staff member</CardTitle>
                <CardDescription>
                  Add a staff member by email and assign a role and branch.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createStaffMember} className="grid gap-4">
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
                      placeholder="Staff member name"
                    />
                  </Label>
                  <Label>
                    Email
                    <Input
                      required
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="teacher@example.com"
                    />
                  </Label>
                  <Label>
                    Role
                    <RoleSelect />
                  </Label>
                  <Button type="submit" className="mt-1">
                    <UserPlus aria-hidden="true" data-icon="inline-start" />
                    Add staff member
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    Staff members
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {staffMembers.length}{" "}
                    {staffMembers.length === 1 ? "member" : "members"} in{" "}
                    {institute.name}
                  </p>
                </div>
                <Badge variant="outline">Owner managed</Badge>
              </div>

              {staffMembers.length ? (
                <div className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
                  {staffMembers.map((staffMember) => (
                    <article key={staffMember.id} className="grid gap-4 p-5">
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">
                              {staffMember.full_name}
                            </h3>
                            <Badge
                              variant={getRoleBadgeVariant(staffMember.role)}
                            >
                              {getRoleLabel(staffMember.role)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {staffMember.email}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Branch:{" "}
                            {staffMember.branch_id
                              ? branchesById.get(staffMember.branch_id)?.name
                              : "Institute-wide"}
                          </p>
                          <div className="mt-2">
                            <Badge
                              variant={
                                staffMember.auth_user_id
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {getLinkStatusLabel(staffMember)}
                            </Badge>
                          </div>
                        </div>
                        <form action={deleteStaffMember}>
                          <input
                            name="staffMemberId"
                            type="hidden"
                            value={staffMember.id}
                          />
                          <ConfirmSubmitButton
                            type="submit"
                            variant="destructive"
                            size="sm"
                            confirmMessage={`Delete ${staffMember.full_name} from staff?`}
                          >
                            <Trash2
                              aria-hidden="true"
                              data-icon="inline-start"
                            />
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>

                      <details className="rounded-md border border-border bg-muted/30 p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                          Edit staff member
                        </summary>
                        <form
                          action={updateStaffMember}
                          className="mt-4 grid gap-3 sm:grid-cols-2"
                        >
                          <input
                            name="staffMemberId"
                            type="hidden"
                            value={staffMember.id}
                          />
                          <Label>
                            Full name
                            <Input
                              required
                              name="fullName"
                              type="text"
                              defaultValue={staffMember.full_name}
                              autoComplete="name"
                            />
                          </Label>
                          <Label>
                            Email
                            <Input
                              required
                              name="email"
                              type="email"
                              defaultValue={staffMember.email}
                              autoComplete="email"
                            />
                          </Label>
                          <Label>
                            Role
                            <RoleSelect defaultValue={staffMember.role} />
                          </Label>
                          <Label>
                            Branch
                            <select
                              required
                              name="branchId"
                              defaultValue={staffMember.branch_id ?? ""}
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
                          <Button
                            type="submit"
                            className="sm:col-span-2 sm:w-fit"
                          >
                            <Save
                              aria-hidden="true"
                              data-icon="inline-start"
                            />
                            Save changes
                          </Button>
                        </form>
                      </details>
                    </article>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">
                      No staff members have been added yet. Add your first
                      staff member to begin.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>
        )}
      </section>
    </DashboardShell>
  );
}
