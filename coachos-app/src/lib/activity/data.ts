import "server-only";

import {
  canAccessPermission,
  requirePermission,
  type DashboardContext,
} from "@/lib/auth/permissions";
import {
  defaultPageSize,
  getPage,
  getPaginationRange,
  getSearchTerm,
  getTotalPages,
  isDateValue,
} from "@/lib/dashboard/list-controls";

export const activityEntityTypes = [
  "student",
  "branch",
  "batch",
  "attendance",
  "fee",
  "homework",
  "test",
  "communication",
  "staff",
  "portal_access",
  "academic_year",
] as const;

export type ActivityEntityType = (typeof activityEntityTypes)[number];

export type ActivityLog = {
  action: string;
  actor_name: string | null;
  actor_role: string | null;
  branch_id: string | null;
  branch_name: string | null;
  created_at: string;
  description: string | null;
  entity_id: string | null;
  entity_label: string | null;
  entity_type: string;
  id: string;
};

type ActivityLogRow = Omit<ActivityLog, "branch_name"> & {
  branches?: { name: string | null } | Array<{ name: string | null }> | null;
};

type ActivitySearchParams = {
  actor?: string;
  branchId?: string;
  entityType?: string;
  fromDate?: string;
  page?: string;
  q?: string;
  toDate?: string;
};

function normalizeActivityRows(rows: ActivityLogRow[] | null | undefined) {
  return (rows ?? []).map((row) => ({
    ...row,
    branch_name: Array.isArray(row.branches)
      ? row.branches[0]?.name ?? null
      : row.branches?.name ?? null,
  }));
}

function canUseActivityBranch(context: DashboardContext, branchId: string) {
  return context.accessibleBranches.some((branch) => branch.id === branchId);
}

function getActivityBranchId(
  context: DashboardContext,
  requestedBranchId: string | null | undefined,
) {
  if (context.role === "owner") {
    if (!requestedBranchId || requestedBranchId === "all") {
      return null;
    }

    return canUseActivityBranch(context, requestedBranchId)
      ? requestedBranchId
      : null;
  }

  return context.branchId ?? null;
}

function getActivityEntityType(value: string | null | undefined) {
  if (activityEntityTypes.includes(value as ActivityEntityType)) {
    return value as ActivityEntityType;
  }

  return null;
}

function getDateTimeStart(value: string | null | undefined) {
  return isDateValue(value) ? `${value}T00:00:00.000+05:30` : null;
}

function getDateTimeEnd(value: string | null | undefined) {
  return isDateValue(value) ? `${value}T23:59:59.999+05:30` : null;
}

export async function getRecentActivity(
  context: DashboardContext,
  limit = 8,
) {
  if (!canAccessPermission(context, "activity.view")) {
    return { error: false, logs: [] as ActivityLog[] };
  }

  let query = context.supabase
    .from("activity_logs")
    .select(
      "id, branch_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, description, created_at, branches(name)",
    )
    .eq("institute_id", context.institute.id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (context.role !== "owner" && context.branchId) {
    query = query.eq("branch_id", context.branchId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("recent activity lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });

    return { error: true, logs: [] as ActivityLog[] };
  }

  return {
    error: false,
    logs: normalizeActivityRows(data as unknown as ActivityLogRow[]),
  };
}

export async function getActivityPageData(params: ActivitySearchParams) {
  const context = await requirePermission("activity.view");
  const page = getPage(params.page);
  const { from, to } = getPaginationRange(page);
  const selectedBranchId = getActivityBranchId(context, params.branchId);
  const selectedEntityType = getActivityEntityType(params.entityType);
  const searchTerm = getSearchTerm(params.q);
  const actorTerm = getSearchTerm(params.actor);
  const fromDateTime = getDateTimeStart(params.fromDate);
  const toDateTime = getDateTimeEnd(params.toDate);

  let query = context.supabase
    .from("activity_logs")
    .select(
      "id, branch_id, actor_name, actor_role, action, entity_type, entity_id, entity_label, description, created_at, branches(name)",
      { count: "exact" },
    )
    .eq("institute_id", context.institute.id)
    .order("created_at", { ascending: false });

  if (selectedBranchId) {
    query = query.eq("branch_id", selectedBranchId);
  } else if (context.role !== "owner" && context.branchId) {
    query = query.eq("branch_id", context.branchId);
  }

  if (selectedEntityType) {
    query = query.eq("entity_type", selectedEntityType);
  }

  if (fromDateTime) {
    query = query.gte("created_at", fromDateTime);
  }

  if (toDateTime) {
    query = query.lte("created_at", toDateTime);
  }

  if (actorTerm) {
    query = query.ilike("actor_name", `%${actorTerm}%`);
  }

  if (searchTerm) {
    query = query.or(
      [
        `action.ilike.%${searchTerm}%`,
        `entity_label.ilike.%${searchTerm}%`,
        `description.ilike.%${searchTerm}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query.range(from, to);
  const totalCount = count ?? 0;

  if (error) {
    console.error("activity logs lookup failed", {
      actorTerm,
      branchId: selectedBranchId,
      code: error.code,
      details: error.details,
      entityType: selectedEntityType,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      searchTerm,
      userId: context.claims.sub,
    });
  }

  return {
    branches: context.accessibleBranches,
    context,
    error: Boolean(error),
    filters: {
      actor: params.actor ?? "",
      branchId: selectedBranchId ?? "all",
      entityType: selectedEntityType ?? "all",
      fromDate: isDateValue(params.fromDate) ? params.fromDate ?? "" : "",
      q: params.q ?? "",
      toDate: isDateValue(params.toDate) ? params.toDate ?? "" : "",
    },
    logs: error ? [] : normalizeActivityRows(data as unknown as ActivityLogRow[]),
    page,
    totalCount,
    totalPages: getTotalPages(totalCount, defaultPageSize),
  };
}

export function getActivityActionLabel(action: string) {
  const labels: Record<string, string> = {
    "academic_year.created": "Academic Year created",
    "academic_year.deleted": "Academic Year deleted",
    "academic_year.updated": "Academic Year updated",
    "academic_year.activated": "Active Academic Year updated",
    "announcement.deleted": "Announcement deleted",
    "announcement.published": "Announcement published",
    "announcement.updated": "Announcement updated",
    "attendance.reopened": "Attendance reopened",
    "attendance.saved": "Attendance saved and locked",
    "batch.created": "Batch created",
    "batch.deleted": "Batch deleted",
    "batch.updated": "Batch updated",
    "branch.created": "Branch created",
    "branch.updated": "Branch updated",
    "fee.created": "Fee Record created",
    "fee.deleted": "Fee Record deleted",
    "fee.marked_paid": "Payment marked as paid",
    "fee.updated": "Fee Record updated",
    "homework.archived": "Homework archived",
    "homework.created": "Homework assigned",
    "homework.deleted": "Homework deleted",
    "homework.submission_updated": "Homework submission updated",
    "homework.updated": "Homework updated",
    "portal_access.disabled": "Portal access disabled",
    "portal_access.saved": "Portal access saved",
    "staff.created": "Staff Member created",
    "staff.deleted": "Staff Member deleted",
    "staff.updated": "Staff Member updated",
    "student.archived": "Student archived",
    "student.created": "Student created",
    "student.deleted": "Student deleted",
    "student.reactivated": "Student reactivated",
    "student.updated": "Student updated",
    "test.archived": "Test archived",
    "test.created": "Test created",
    "test.deleted": "Test deleted",
    "test.score_updated": "Test scores updated",
    "test.updated": "Test updated",
  };

  return (
    labels[action] ??
    action
      .split(".")
      .filter(Boolean)
      .map((part) => part.replaceAll("_", " "))
      .join(" ")
  );
}

export function getActivityEntityLabel(entityType: string) {
  const labels: Record<string, string> = {
    academic_year: "Academic Year",
    attendance: "Attendance Record",
    batch: "Batch",
    branch: "Branch",
    communication: "Communication",
    fee: "Fee Record",
    homework: "Homework",
    portal_access: "Portal Access",
    staff: "Staff Member",
    student: "Student",
    test: "Test",
  };

  return labels[entityType] ?? "Record";
}
