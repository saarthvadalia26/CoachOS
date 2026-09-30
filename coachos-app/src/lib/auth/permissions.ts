import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import {
  rolePermissions,
  type AppRole,
  type Permission,
  type Branch,
  type Membership,
  canAccessPermission,
  scopeMatchesMembership,
  normalizeRole,
  type PermissionScope,
} from "./permissions-base";

export {
  appRoles,
  type AppRole,
  type Role,
  staffRoles,
  type StaffRole,
  permissions,
  type Permission,
  type Branch,
  type Membership,
  type PermissionScope,
  normalizeRole,
  getRolePermissions,
  hasPermission,
  hasAnyPermission,
  canAccessPermission,
} from "./permissions-base";

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

type PortalClaimStatus =
  | "already_claimed"
  | "ambiguous"
  | "failed"
  | "linked"
  | "no_match"
  | "unauthenticated";

type StaffLinkResult = {
  profile: Profile | null;
  status: StaffLinkStatus;
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
    return "This staff account could not be linked. Ask the institute owner to review the staff record.";
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

async function getPortalRedirectForUser(
  supabase: SupabaseServerClient,
  userId: string,
) {
  const { data: studentLinks, error: studentLinksError } = await supabase
    .from("student_portal_links")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("status", "linked")
    .limit(1);

  if (!studentLinksError && studentLinks?.length) {
    return "/portal/student";
  }

  const { data: parentLinks, error: parentLinksError } = await supabase
    .from("parent_portal_links")
    .select("id")
    .eq("auth_user_id", userId)
    .eq("status", "linked")
    .limit(1);

  if (!parentLinksError && parentLinks?.length) {
    return "/portal/parent";
  }

  if (studentLinksError || parentLinksError) {
    console.error("portal redirect lookup failed", {
      parentError: parentLinksError,
      studentError: studentLinksError,
    });
  }

  const studentClaimStatus = await claimPortalAccessForRedirect(
    supabase,
    "student",
  );

  if (shouldRedirectToPortal(studentClaimStatus)) {
    return "/portal/student";
  }

  const parentClaimStatus = await claimPortalAccessForRedirect(
    supabase,
    "parent",
  );

  if (shouldRedirectToPortal(parentClaimStatus)) {
    return "/portal/parent";
  }

  return null;
}

function shouldRedirectToPortal(status: PortalClaimStatus) {
  return (
    status === "already_claimed" ||
    status === "ambiguous" ||
    status === "linked"
  );
}

async function claimPortalAccessForRedirect(
  supabase: SupabaseServerClient,
  kind: "parent" | "student",
): Promise<PortalClaimStatus> {
  const rpcName =
    kind === "student"
      ? "claim_student_portal_link_result"
      : "claim_parent_portal_links_result";
  const { data, error } = await supabase.rpc(rpcName);

  if (error) {
    console.error("portal post-auth claim failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      kind,
      message: error.message,
    });

    return "failed";
  }

  if (
    data === "already_claimed" ||
    data === "ambiguous" ||
    data === "failed" ||
    data === "linked" ||
    data === "no_match" ||
    data === "unauthenticated"
  ) {
    return data;
  }

  return "failed";
}

function getAllowedNextPath(
  requestedNext: string,
  resolvedPath: "/dashboard" | "/onboarding" | "/portal/parent" | "/portal/student",
) {
  if (resolvedPath === "/dashboard" && requestedNext.startsWith("/dashboard")) {
    return requestedNext;
  }

  if (
    resolvedPath === "/portal/student" &&
    requestedNext.startsWith("/portal/student")
  ) {
    return requestedNext;
  }

  if (
    resolvedPath === "/portal/parent" &&
    requestedNext.startsWith("/portal/parent")
  ) {
    return requestedNext;
  }

  return resolvedPath;
}

export async function resolvePostAuthRedirect(
  supabase: SupabaseServerClient,
  requestedNext = "/dashboard",
) {
  const safeNext =
    requestedNext.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : "/dashboard";
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as AuthClaims | undefined;

  if (error || !claims) {
    return "/login";
  }

  const profile = await getProfileForUser(supabase, claims.sub);
  let memberships = await getMembershipsForUser(supabase, claims.sub);

  if (!profile || !memberships.length) {
    const linkedStaff = await linkMatchingStaffProfile(supabase, claims.sub);

    if (linkedStaff.status === "linked") {
      memberships = await getMembershipsForUser(supabase, claims.sub);
    }
  }

  if (memberships.length) {
    return getAllowedNextPath(safeNext, "/dashboard");
  }

  const portalRedirect = await getPortalRedirectForUser(supabase, claims.sub);

  if (portalRedirect === "/portal/student") {
    return getAllowedNextPath(safeNext, "/portal/student");
  }

  if (portalRedirect === "/portal/parent") {
    return getAllowedNextPath(safeNext, "/portal/parent");
  }

  if (
    safeNext.startsWith("/portal/student") ||
    safeNext.startsWith("/portal/parent")
  ) {
    return safeNext;
  }

  return "/onboarding";
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
    const portalRedirect = await getPortalRedirectForUser(
      context.supabase,
      context.claims.sub,
    );

    if (portalRedirect) {
      redirect(portalRedirect);
    }

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
