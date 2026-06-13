import { Save, Search, Trash2, UserPlus } from "lucide-react";
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
  requirePermission,
  staffRoles,
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
  createStaffMember,
  deleteStaffMember,
  updateStaffMember,
} from "@/lib/staff/actions";

type StaffPageProps = {
  searchParams: Promise<{
    branchId?: string;
    error?: string;
    linkStatus?: string;
    page?: string;
    q?: string;
    role?: string;
    success?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Staff",
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

function getSelectedRole(value: string | null | undefined) {
  return staffRoles.includes(value as (typeof staffRoles)[number])
    ? String(value)
    : "";
}

function getSelectedLinkStatus(value: string | null | undefined) {
  return value === "linked" || value === "pending" ? value : "";
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
  const { accessibleBranches, supabase, claims, institute, profile, role } =
    context;
  const params = await searchParams;
  const branchScope = getBranchScope(context, params.branchId);
  const searchTerm = getSearchTerm(params.q);
  const selectedRole = getSelectedRole(params.role);
  const selectedLinkStatus = getSelectedLinkStatus(params.linkStatus);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
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
    .select("id, branch_id, auth_user_id, full_name, email, role, created_at", {
      count: "exact",
    })
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

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    scopedStaffQuery = scopedStaffQuery.or(
      `full_name.ilike.${searchPattern},email.ilike.${searchPattern}`,
    );
  }

  if (selectedRole) {
    scopedStaffQuery = scopedStaffQuery.eq("role", selectedRole);
  }

  if (selectedLinkStatus === "linked") {
    scopedStaffQuery = scopedStaffQuery.not("auth_user_id", "is", null);
  } else if (selectedLinkStatus === "pending") {
    scopedStaffQuery = scopedStaffQuery.is("auth_user_id", null);
  }

  const { data: staffRows, count: staffCount, error: staffError } =
    await scopedStaffQuery.range(paginationRange.from, paginationRange.to);

  const staffMembers = (staffRows ?? []) as StaffMember[];
  const totalStaffMembers = staffCount ?? 0;
  const filterParams = {
    branchId: branchScope.selectedBranchId,
    linkStatus: selectedLinkStatus,
    q: searchTerm,
    role: selectedRole,
  };
  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedRole ||
      selectedLinkStatus ||
      branchScope.selectedBranchId,
  );

  return (
    <DashboardShell
      activePage="staff"
      instituteName={institute.name}
      role={role}
      title="Staff"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Find staff members</CardTitle>
            <CardDescription>
              Search by name or email, then filter by role and account status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3">
              <div
                className={
                  branchScope.showOwnerBranchFilter
                    ? "grid gap-3 md:grid-cols-2 xl:grid-cols-4"
                    : "grid gap-3 md:grid-cols-3"
                }
              >
                <Label>
                  Search
                  <Input
                    name="q"
                    type="search"
                    defaultValue={searchTerm}
                    placeholder="Name or email"
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
                  Role
                  <select
                    name="role"
                    defaultValue={selectedRole}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All roles</option>
                    {staffRoles.map((staffRole) => (
                      <option key={staffRole} value={staffRole}>
                        {getRoleLabel(staffRole)}
                      </option>
                    ))}
                  </select>
                </Label>
                <Label>
                  Account status
                  <select
                    name="linkStatus"
                    defaultValue={selectedLinkStatus}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    <option value="">All statuses</option>
                    <option value="linked">Linked</option>
                    <option value="pending">Pending setup</option>
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
                  <Link href="/dashboard/staff">Reset filters</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ActionMessage
          error={
            staffError
              ? "Staff member records are unavailable right now. Please try again."
              : null
          }
        />

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
                <div className="grid gap-4">
                  <div className="divide-y divide-border rounded-md border border-border">
                    {staffMembers.map((staffMember) => (
                      <article key={staffMember.id} className="grid gap-3 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h2 className="break-words font-medium">
                              {staffMember.full_name}
                            </h2>
                            <p className="mt-1 break-all text-sm text-muted-foreground sm:break-normal">
                              {staffMember.email}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
                            <Badge
                              variant={getRoleBadgeVariant(staffMember.role)}
                            >
                              {getRoleLabel(staffMember.role)}
                            </Badge>
                            <Badge variant="outline">
                              {staffMember.branch_id
                                ? branchesById.get(staffMember.branch_id)
                                    ?.name ?? "Branch"
                                : "Institute-wide"}
                            </Badge>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/staff"
                    page={page}
                    pageSize={defaultPageSize}
                    params={filterParams}
                    totalCount={totalStaffMembers}
                  />
                </div>
              ) : (
                <EmptyState
                  title={
                    hasActiveFilters
                      ? "No staff members match these filters"
                      : "No staff members available"
                  }
                  description={
                    hasActiveFilters
                      ? "Adjust your search, role, branch, or account status filters to find staff records."
                      : "No staff members are available for your branch."
                  }
                />
              )}
            </CardContent>
          </Card>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <Card id="add-staff-member">
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
                  <SubmitButton className="mt-1" pendingLabel="Creating...">
                    <UserPlus aria-hidden="true" data-icon="inline-start" />
                    Add staff member
                  </SubmitButton>
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
                    {getPageSummary({
                      page,
                      shownCount: staffMembers.length,
                      totalCount: totalStaffMembers,
                    })}{" "}
                    in {institute.name}
                  </p>
                </div>
                <Badge variant="outline">Owner managed</Badge>
              </div>

              {staffMembers.length ? (
                <div className="grid gap-4">
                  <div className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
                    {staffMembers.map((staffMember) => (
                      <article key={staffMember.id} className="grid gap-4 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="break-words font-medium">
                              {staffMember.full_name}
                          </h3>
                          <p className="mt-1 break-all text-sm text-muted-foreground sm:break-normal">
                            {staffMember.email}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Badge
                              variant={getRoleBadgeVariant(staffMember.role)}
                            >
                              {getRoleLabel(staffMember.role)}
                            </Badge>
                            <Badge variant="outline">
                            {staffMember.branch_id
                              ? branchesById.get(staffMember.branch_id)?.name
                              : "Institute-wide"}
                            </Badge>
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
                        <form action={deleteStaffMember} className="shrink-0">
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
                            confirmTitle="Delete staff member?"
                            confirmDescription={`This will remove ${staffMember.full_name} from the staff list. Linked access will be removed according to the current account rules. This action cannot be undone.`}
                            confirmLabel="Delete staff member"
                            pendingLabel="Deleting..."
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
                      </article>
                    ))}
                  </div>
                  <PaginationControls
                    basePath="/dashboard/staff"
                    page={page}
                    pageSize={defaultPageSize}
                    params={filterParams}
                    totalCount={totalStaffMembers}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-5">
                    <EmptyState
                      actionHref={
                        !hasActiveFilters
                          ? "/dashboard/staff#add-staff-member"
                          : undefined
                      }
                      actionLabel="Add staff member"
                      title={
                        hasActiveFilters
                          ? "No staff members match these filters"
                          : "No staff members added yet"
                      }
                      description={
                        hasActiveFilters
                          ? "Adjust your search, role, branch, or account status filters to find staff records."
                          : "Add your team members and assign branch-level roles."
                      }
                    />
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
