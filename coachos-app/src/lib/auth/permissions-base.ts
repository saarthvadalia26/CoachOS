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
  "homework.view",
  "homework.create",
  "homework.update",
  "homework.archive",
  "homework.delete",
  "attendance.view",
  "attendance.create",
  "attendance.update",
  "attendance.alert",
  "academic_years.view",
  "academic_years.create",
  "academic_years.update",
  "academic_years.delete",
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
  "communications.view",
  "communications.create",
  "communications.update",
  "communications.delete",
  "notifications.view",
  "notifications.update",
  "activity.view",
  "branches.view",
  "branches.create",
  "branches.update",
  "reports.view",
  "settings.manage",
  "tests.view",
  "tests.create",
  "tests.update",
  "tests.archive",
  "tests.delete",
] as const;

export type Permission = (typeof permissions)[number];

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

export const rolePermissions = {
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
    "homework.view",
    "homework.create",
    "homework.update",
    "homework.archive",
    "homework.delete",
    "attendance.view",
    "attendance.create",
    "attendance.update",
    "attendance.alert",
    "academic_years.view",
    "fees.view",
    "fees.create",
    "fees.update",
    "fees.record_payment",
    "fees.mark_paid",
    "fees.apply_discount",
    "fees.export",
    "fees.send_reminder",
    "staff.view",
    "communications.view",
    "communications.create",
    "communications.update",
    "communications.delete",
    "notifications.view",
    "notifications.update",
    "activity.view",
    "branches.view",
    "reports.view",
    "tests.view",
    "tests.create",
    "tests.update",
    "tests.archive",
    "tests.delete",
  ],
  operations_staff: [
    "students.view",
    "students.create",
    "students.update",
    "batches.view",
    "homework.view",
    "attendance.view",
    "attendance.create",
    "attendance.update",
    "fees.view",
    "fees.send_reminder",
    "communications.view",
    "notifications.view",
    "notifications.update",
    "activity.view",
    "tests.view",
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
    "fees.send_reminder",
    "communications.view",
    "notifications.view",
    "notifications.update",
    "activity.view",
  ],
  academic_coordinator: [
    "students.view",
    "batches.view",
    "batches.create",
    "batches.update",
    "homework.view",
    "homework.create",
    "homework.update",
    "homework.archive",
    "homework.delete",
    "attendance.view",
    "attendance.alert",
    "communications.view",
    "notifications.view",
    "notifications.update",
    "activity.view",
    "tests.view",
    "tests.create",
    "tests.update",
    "tests.archive",
    "tests.delete",
  ],
  teacher: [
    "students.view",
    "batches.view",
    "homework.view",
    "homework.create",
    "homework.update",
    "attendance.view",
    "communications.view",
    "notifications.view",
    "notifications.update",
    "tests.view",
    "tests.create",
    "tests.update",
    "tests.archive",
    "tests.delete",
  ],
} as const satisfies Record<AppRole, readonly Permission[]>;

export const teacherScopedPermissions: readonly Permission[] = [
  "students.view",
  "batches.view",
  "homework.view",
  "homework.create",
  "homework.update",
  "attendance.view",
  "tests.view",
  "tests.create",
  "tests.update",
  "tests.archive",
  "tests.delete",
] as const;

export function normalizeRole(role: string | null | undefined) {
  if (appRoles.includes(role as AppRole)) {
    return role as AppRole;
  }

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

export function scopeMatchesMembership(
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
  context: {
    accessibleBranches: Branch[];
    memberships: Membership[];
  },
  permission: Permission,
  scope?: PermissionScope,
) {
  return context.memberships.some((membership) => {
    if (!hasPermission(membership.role, permission)) {
      return false;
    }

    if (
      membership.role === "teacher" &&
      !teacherScopedPermissions.includes(permission)
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
