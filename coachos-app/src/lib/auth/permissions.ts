import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const appRoles = [
  "owner",
  "branch_manager",
  "operations_staff",
  "accountant",
  "academic_coordinator",
  "teacher",
] as const;

export type AppRole = (typeof appRoles)[number];
export type Role = AppRole;

// Product rule: owner is created during institute onboarding only. The staff
// page manages non-owner operational roles.
export const staffRoles = [
  "branch_manager",
  "operations_staff",
  "accountant",
  "academic_coordinator",
  "teacher",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export const permissions = [
  "students.view",
  "students.create",
  "students.update",
  "students.delete",
  "batches.view",
  "batches.create",
  "batches.update",
  "batches.delete",
  "attendance.view",
  "attendance.create",
  "attendance.update",
  "fees.view",
  "fees.create",
  "fees.update",
  "fees.record_payment",
  "fees.mark_paid",
  "fees.apply_discount",
  "fees.export",
  "fees.send_reminder",
  "staff.view",
  "staff.create",
  "staff.update",
  "staff.delete",
  "branches.view",
  "branches.create",
  "branches.update",
  "reports.view",
  "settings.manage",
] as const;

export type Permission = (typeof permissions)[number];

type AuthClaims = {
  email?: string;
  sub: string;
};

type Profile = {
  full_name: string | null;
  institute_id: string | null;
  role: string | null;
};

type DashboardProfile = {
  full_name: string | null;
  institute_id: string;
  role: AppRole;
};

type Institute = {
  id: string;
  name: string;
  owner_id: string;
};

export type StaffLinkStatus =
  | "not_checked"
  | "linked"
  | "no_match"
  | "ambiguous"
  | "profile_conflict"
  | "already_claimed"
  | "failed"
  | "unauthenticated";

export type Branch = {
  address: string | null;
  id: string;
  institute_id: string;
  name: string;
};

export type Membership = {
  branch_id: string | null;
  created_at: string | null;
  id: string;
  institute_id: string;
  role: AppRole;
  user_id: string;
};

export type PermissionScope = {
  attendanceSessionId?: string;
  batchId?: string;
  branchId?: string | null;
  feeRecordId?: string;
  instituteId?: string | null;
  staffMemberId?: string;
  studentId?: string;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type MembershipContext = {
  accessibleBranches: Branch[];
  branchId: string | null;
  branchScope: "all" | "branch";
  claims: AuthClaims;
  currentMembership: Membership | null;
  institute: Institute | null;
  memberships: Membership[];
  permissions: readonly Permission[];
  profile: Profile | null;
  role: AppRole | null;
  staffLinkStatus: StaffLinkStatus;
  supabase: SupabaseServerClient;
};

type StaffLinkResult = {
  profile: Profile | null;
  status: StaffLinkStatus;
};

export type DashboardContext = Omit<
  MembershipContext,
  "currentMembership" | "institute" | "profile" | "role"
> & {
  currentMembership: Membership;
  institute: Institute;
  profile: DashboardProfile;
  role: AppRole;
};

const rolePriority: Record<AppRole, number> = {
  owner: 0,
  branch_manager: 1,
  operations_staff: 2,
  accountant: 3,
  academic_coordinator: 4,
  teacher: 5,
};

const rolePermissions = {
  owner: permissions,
  branch_manager: [
    "students.view",
    "students.create",
    "students.update",
    "students.delete",
    "batches.view",
    "batches.create",
    "batches.update",
    "batches.delete",
    "attendance.view",
    "attendance.create",
    "attendance.update",
    "fees.view",
    "fees.create",
    "fees.update",
    "fees.record_payment",
    "fees.mark_paid",
    "fees.apply_discount",
    "fees.export",
    "fees.send_reminder",
    "staff.view",
    "branches.view",
    "reports.view",
  ],
  operations_staff: [
    "students.view",
    "students.create",
    "students.update",
    "batches.view",
    "attendance.view",
    "attendance.create",
    "attendance.update",
    "fees.view",
    "fees.send_reminder",
  ],
  accountant: [
    "students.view",
    "fees.view",
    "fees.create",
    "fees.update",
    "fees.record_payment",
    "fees.mark_paid",
    "fees.apply_discount",
    "fees.export",
  ],
  academic_coordinator: [
    "students.view",
    "batches.view",
    "batches.create",
    "batches.update",
    "attendance.view",
  ],
  teacher: ["students.view", "batches.view", "attendance.view"],
} as const satisfies Record<AppRole, readonly Permission[]>;

const viewOnlyTeacherPermissions: readonly Permission[] = [
  "students.view",
  "batches.view",
  "attendance.view",
] as const;

export function normalizeRole(role: string | null | undefined) {
  if (appRoles.includes(role as AppRole)) {
    return role as AppRole;
  }

  // Legacy profile/staff rows used "staff". In the membership model, that maps
  // to accountant instead of remaining an authoritative app role.
  if (role === "staff") {
    return "accountant";
  }

  return null;
}

export function getRolePermissions(role: AppRole) {
  return rolePermissions[role];
}

export function hasPermission(role: AppRole, permission: Permission) {
  return (rolePermissions[role] as readonly Permission[]).includes(permission);
}

export function hasAnyPermission(
  role: AppRole,
  requestedPermissions: readonly Permission[],
) {
  return requestedPermissions.some((permission) =>
    hasPermission(role, permission),
  );
}

export function getStaffLinkStatusMessage(status: StaffLinkStatus) {
  if (status === "ambiguous") {
    return "Your email matches multiple staff records. Ask the institute owner to remove duplicate staff records before signing in.";
  }

  if (status === "profile_conflict") {
    return "This account is already connected to another institute.";
  }

  if (status === "already_claimed") {
    return "This staff record is already linked to another account.";
  }

  if (status === "failed") {
    return "Could not link this staff account. Ask the institute owner to check the staff record.";
  }

  return "";
}

export function isBlockingStaffLinkStatus(status: StaffLinkStatus) {
  return Boolean(getStaffLinkStatusMessage(status));
}

function getUniquePermissions(memberships: readonly Membership[]) {
  const permissionSet = new Set<Permission>();

  for (const membership of memberships) {
    for (const permission of rolePermissions[membership.role]) {
      permissionSet.add(permission);
    }
  }

  return Array.from(permissionSet);
}

function sortBranches(branches: Branch[]) {
  return [...branches].sort((first, second) => {
    if (first.name === "Main Branch" && second.name !== "Main Branch") {
      return -1;
    }

    if (second.name === "Main Branch" && first.name !== "Main Branch") {
      return 1;
    }

    return first.name.localeCompare(second.name);
  });
}

function sortMemberships(memberships: Membership[]) {
  return [...memberships].sort((first, second) => {
    const roleDifference = rolePriority[first.role] - rolePriority[second.role];

    if (roleDifference !== 0) {
      return roleDifference;
    }

    return (first.created_at ?? "").localeCompare(second.created_at ?? "");
  });
}

function getPrimaryMembership(
  memberships: Membership[],
  preferredInstituteId: string | null | undefined,
) {
  const scopedMemberships = preferredInstituteId
    ? memberships.filter(
        (membership) => membership.institute_id === preferredInstituteId,
      )
    : memberships;

  return sortMemberships(
    scopedMemberships.length ? scopedMemberships : memberships,
  )[0] ?? null;
}

async function getProfileForUser(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, institute_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("getProfileForUser failed", error);
  }

  return (profile as Profile | null) ?? null;
}

async function linkMatchingStaffProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StaffLinkResult> {
  const { data: status, error } = await supabase.rpc(
    "claim_staff_member_profile_result",
  );

  if (error) {
    console.error("claim_staff_member_profile_result failed", error);
    return {
      profile: null,
      status: "failed",
    };
  }

  const linkStatus = String(status ?? "failed") as StaffLinkStatus;

  if (linkStatus !== "linked") {
    return {
      profile: null,
      status: linkStatus,
    };
  }

  return {
    profile: await getProfileForUser(supabase, userId),
    status: "linked",
  };
}

async function getMembershipsForUser(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("id, user_id, institute_id, branch_id, role, created_at")
    .eq("user_id", userId);

  if (error) {
    console.error("getMembershipsForUser failed", error);
    return [];
  }

  return ((memberships ?? []) as Array<
    Omit<Membership, "role"> & { role: string | null }
  >)
    .map((membership) => {
      const role = normalizeRole(membership.role);

      if (!role) {
        return null;
      }

      return {
        ...membership,
        role,
      };
    })
    .filter((membership): membership is Membership => Boolean(membership));
}

async function getInstituteById(
  supabase: SupabaseServerClient,
  instituteId: string,
) {
  const { data: institute, error } = await supabase
    .from("institutes")
    .select("id, name, owner_id")
    .eq("id", instituteId)
    .maybeSingle();

  if (error) {
    console.error("getInstituteById failed", error);
  }

  return (institute as Institute | null) ?? null;
}

async function getAccessibleBranches(
  supabase: SupabaseServerClient,
  instituteId: string,
  memberships: readonly Membership[],
) {
  const hasOwnerMembership = memberships.some(
    (membership) =>
      membership.institute_id === instituteId && membership.role === "owner",
  );

  let query = supabase
    .from("branches")
    .select("id, institute_id, name, address")
    .eq("institute_id", instituteId);

  if (!hasOwnerMembership) {
    const branchIds = memberships
      .filter((membership) => membership.institute_id === instituteId)
      .map((membership) => membership.branch_id)
      .filter((branchId): branchId is string => Boolean(branchId));

    if (!branchIds.length) {
      return [];
    }

    query = query.in("id", branchIds);
  }

  const { data: branches, error } = await query.order("name", {
    ascending: true,
  });

  if (error) {
    console.error("getAccessibleBranches failed", error);
    return [];
  }

  return sortBranches((branches ?? []) as Branch[]);
}

function scopeMatchesMembership(
  membership: Membership,
  accessibleBranches: readonly Branch[],
  scope?: PermissionScope,
) {
  if (scope?.instituteId && scope.instituteId !== membership.institute_id) {
    return false;
  }

  if (membership.role === "owner") {
    if (!scope?.branchId) {
      return true;
    }

    return accessibleBranches.some((branch) => branch.id === scope.branchId);
  }

  if (!membership.branch_id) {
    return false;
  }

  if (scope?.branchId) {
    return scope.branchId === membership.branch_id;
  }

  return true;
}

export function canAccessPermission(
  context: Pick<
    MembershipContext,
    "accessibleBranches" | "memberships"
  >,
  permission: Permission,
  scope?: PermissionScope,
) {
  return context.memberships.some((membership) => {
    if (!hasPermission(membership.role, permission)) {
      return false;
    }

    if (
      membership.role === "teacher" &&
      !viewOnlyTeacherPermissions.includes(permission)
    ) {
      return false;
    }

    return scopeMatchesMembership(
      membership,
      context.accessibleBranches,
      scope,
    );
  });
}

export function getDefaultBranchId(context: Pick<DashboardContext, "accessibleBranches" | "branchId">) {
  return context.branchId ?? context.accessibleBranches[0]?.id ?? null;
}

function getDashboardProfileRole(membershipRole: AppRole) {
  return membershipRole;
}

export async function claimStaffProfileForCurrentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;

  if (error || !claims) {
    redirect("/login");
  }

  return linkMatchingStaffProfile(supabase, claims.sub);
}

export async function getCurrentMembershipContext(): Promise<MembershipContext> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;

  if (error || !claims) {
    redirect("/login");
  }

  let profile = await getProfileForUser(supabase, claims.sub);
  let memberships = await getMembershipsForUser(supabase, claims.sub);
  let staffLinkStatus: StaffLinkStatus = "not_checked";

  // Staff linking flow:
  // Profiles is identity/onboarding only. If a newly signed-up team user has no
  // profile or membership yet, claim a matching staff_members row by verified
  // auth email. The SQL function handles duplicate-email ambiguity and creates
  // both profiles and the authoritative memberships row for the institute.
  if (!profile || !memberships.length) {
    const linkedStaff = await linkMatchingStaffProfile(supabase, claims.sub);
    staffLinkStatus = linkedStaff.status;

    if (linkedStaff.profile) {
      profile = linkedStaff.profile;
    }

    if (linkedStaff.status === "linked") {
      memberships = await getMembershipsForUser(supabase, claims.sub);
    }
  }

  const currentMembership = getPrimaryMembership(
    memberships,
    profile?.institute_id,
  );
  const role = currentMembership?.role ?? null;
  const institute = currentMembership
    ? await getInstituteById(supabase, currentMembership.institute_id)
    : null;
  const instituteMemberships = institute
    ? memberships.filter(
        (membership) => membership.institute_id === institute.id,
      )
    : [];
  const accessibleBranches = institute
    ? await getAccessibleBranches(supabase, institute.id, instituteMemberships)
    : [];
  const branchId =
    currentMembership?.role === "owner"
      ? null
      : currentMembership?.branch_id ?? accessibleBranches[0]?.id ?? null;

  return {
    accessibleBranches,
    branchId,
    branchScope: currentMembership?.role === "owner" ? "all" : "branch",
    claims,
    currentMembership,
    institute,
    memberships: instituteMemberships,
    permissions: getUniquePermissions(instituteMemberships),
    profile,
    role,
    staffLinkStatus,
    supabase,
  };
}

// Backward-compatible alias for existing onboarding/access-denied pages.
export const getCurrentUserContext = getCurrentMembershipContext;

export async function requireDashboardAccess(): Promise<DashboardContext> {
  const context = await getCurrentMembershipContext();

  if (!context.profile?.institute_id && !context.currentMembership) {
    const staffLinkMessage = getStaffLinkStatusMessage(
      context.staffLinkStatus,
    );

    if (staffLinkMessage) {
      redirect(
        `/onboarding?error=${encodeURIComponent(staffLinkMessage)}`,
      );
    }

    redirect("/onboarding");
  }

  if (!context.role || !context.institute || !context.currentMembership) {
    redirect("/dashboard/access-denied");
  }

  return {
    ...context,
    currentMembership: context.currentMembership,
    institute: context.institute,
    profile: {
      full_name: context.profile?.full_name ?? null,
      institute_id: context.institute.id,
      role: getDashboardProfileRole(context.role),
    },
    role: context.role,
  };
}

export async function requireInstituteAccess(instituteId: string) {
  const context = await requireDashboardAccess();

  if (
    !context.memberships.some(
      (membership) => membership.institute_id === instituteId,
    )
  ) {
    redirect("/dashboard/access-denied");
  }

  return context;
}

export async function requireBranchAccess(branchId: string) {
  const context = await requireDashboardAccess();
  const hasBranchAccess = context.memberships.some((membership) => {
    if (membership.role === "owner") {
      return context.accessibleBranches.some((branch) => branch.id === branchId);
    }

    return membership.branch_id === branchId;
  });

  if (!hasBranchAccess) {
    redirect("/dashboard/access-denied");
  }

  return context;
}

export async function requirePermission(
  permission: Permission,
  scope?: PermissionScope,
) {
  const context = await requireDashboardAccess();

  if (!canAccessPermission(context, permission, scope)) {
    redirect("/dashboard/access-denied");
  }

  return context;
}

export async function requireOwner() {
  const context = await requireDashboardAccess();

  if (
    !context.memberships.some((membership) => membership.role === "owner")
  ) {
    redirect("/dashboard/access-denied");
  }

  return context;
}

export async function requireBranchManagerOrOwner(scope?: PermissionScope) {
  const context = await requireDashboardAccess();
  const hasAccess = context.memberships.some((membership) => {
    if (membership.role === "owner") {
      return scopeMatchesMembership(
        membership,
        context.accessibleBranches,
        scope,
      );
    }

    return (
      membership.role === "branch_manager" &&
      scopeMatchesMembership(membership, context.accessibleBranches, scope)
    );
  });

  if (!hasAccess) {
    redirect("/dashboard/access-denied");
  }

  return context;
}
