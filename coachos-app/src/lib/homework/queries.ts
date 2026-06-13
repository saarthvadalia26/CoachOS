import { requirePermission, type DashboardContext } from "@/lib/auth/permissions";
import {
  getPage,
  getPaginationRange,
  getSearchTerm,
  isDateValue,
} from "@/lib/dashboard/list-controls";

const homeworkStatuses = ["active", "completed", "archived"] as const;

export type HomeworkStatus = (typeof homeworkStatuses)[number];

export type HomeworkAssignmentRow = {
  batch_id: string;
  branch_id: string;
  created_at: string;
  created_by: string | null;
  description: string | null;
  due_date: string | null;
  id: string;
  institute_id: string;
  status: HomeworkStatus;
  subject: string | null;
  title: string;
  updated_at: string;
};

export type HomeworkBatchOption = {
  branch_id: string;
  id: string;
  name: string;
  subject: string | null;
};

export type HomeworkListParams = {
  batchId?: string;
  branchId?: string;
  dueDate?: string;
  page?: string;
  q?: string;
  status?: string;
};

function getSelectedStatus(value: string | null | undefined): "" | HomeworkStatus {
  if (homeworkStatuses.includes(value as HomeworkStatus)) {
    return value as HomeworkStatus;
  }

  return "";
}

async function getTeacherAssignedBatchIds(context: DashboardContext) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return [];
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("batch_id")
    .in("membership_id", teacherMembershipIds);

  if (error) {
    console.error("homework teacher batch list failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    return [];
  }

  return Array.from(
    new Set((data ?? []).map((row) => row.batch_id).filter(Boolean)),
  ) as string[];
}

async function getVisibleHomeworkBatchIds(context: DashboardContext) {
  if (context.role === "teacher") {
    return getTeacherAssignedBatchIds(context);
  }

  return null;
}

function getEmptyResult({
  batches,
  context,
  error,
  filters,
  page,
}: {
  batches: HomeworkBatchOption[];
  context: DashboardContext;
  error: string | null;
  filters: {
    batchId: string | null;
    branchId: string | null;
    dueDate: string;
    q: string;
    status: "" | HomeworkStatus;
  };
  page: number;
}) {
  return {
    assignments: [] as HomeworkAssignmentRow[],
    batches,
    context,
    error,
    filters,
    page,
    totalCount: 0,
  };
}

export async function listHomeworkAssignments(params: HomeworkListParams) {
  const context = await requirePermission("homework.view");
  const { accessibleBranches, institute, role, supabase } = context;
  const selectedBranch = accessibleBranches.find(
    (branch) => branch.id === params.branchId,
  );
  const selectedBranchId =
    role === "owner" ? selectedBranch?.id ?? null : context.branchId;
  const selectedBatchId = String(params.batchId ?? "").trim() || null;
  const selectedStatus = getSelectedStatus(params.status);
  const selectedDueDate = isDateValue(params.dueDate) ? params.dueDate! : "";
  const searchTerm = getSearchTerm(params.q);
  const page = getPage(params.page);
  const paginationRange = getPaginationRange(page);
  const teacherBatchIds = await getVisibleHomeworkBatchIds(context);
  const visibleBranchIds = selectedBranchId
    ? [selectedBranchId]
    : role === "owner"
      ? []
      : accessibleBranches.map((branch) => branch.id);
  const filters = {
    batchId: selectedBatchId,
    branchId: selectedBranchId,
    dueDate: selectedDueDate,
    q: searchTerm,
    status: selectedStatus,
  };

  let batchesQuery = supabase
    .from("batches")
    .select("id, branch_id, name, subject")
    .eq("institute_id", institute.id)
    .order("name", { ascending: true });

  if (selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", selectedBranchId);
  } else if (visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", visibleBranchIds);
  }

  if (teacherBatchIds) {
    if (!teacherBatchIds.length) {
      return getEmptyResult({
        batches: [],
        context,
        error: null,
        filters,
        page,
      });
    }

    batchesQuery = batchesQuery.in("id", teacherBatchIds);
  }

  const { data: batchRows, error: batchesError } = await batchesQuery;
  const batches = (batchRows ?? []) as HomeworkBatchOption[];
  const allowedBatchIds = batches.map((batch) => batch.id);
  const queryErrorMessage = batchesError
    ? "Homework records are unavailable right now. Please try again."
    : null;

  if (batchesError) {
    console.error("listHomeworkAssignments batches failed", {
      error: batchesError,
      instituteId: institute.id,
      role,
      userId: context.claims.sub,
    });
  }

  if (selectedBatchId && !allowedBatchIds.includes(selectedBatchId)) {
    return getEmptyResult({
      batches,
      context,
      error: queryErrorMessage,
      filters,
      page,
    });
  }

  if (!allowedBatchIds.length) {
    return getEmptyResult({
      batches,
      context,
      error: queryErrorMessage,
      filters,
      page,
    });
  }

  let homeworkQuery = supabase
    .from("homework_assignments")
    .select(
      "id, institute_id, branch_id, batch_id, title, description, subject, due_date, status, created_by, created_at, updated_at",
      { count: "exact" },
    )
    .eq("institute_id", institute.id)
    .in("batch_id", selectedBatchId ? [selectedBatchId] : allowedBatchIds)
    .order("created_at", { ascending: false });

  if (selectedBranchId) {
    homeworkQuery = homeworkQuery.eq("branch_id", selectedBranchId);
  } else if (visibleBranchIds.length) {
    homeworkQuery = homeworkQuery.in("branch_id", visibleBranchIds);
  }

  if (selectedStatus) {
    homeworkQuery = homeworkQuery.eq("status", selectedStatus);
  }

  if (selectedDueDate) {
    homeworkQuery = homeworkQuery.eq("due_date", selectedDueDate);
  }

  if (searchTerm) {
    const searchPattern = `%${searchTerm}%`;
    homeworkQuery = homeworkQuery.or(
      `title.ilike.${searchPattern},subject.ilike.${searchPattern}`,
    );
  }

  const { data, count, error } = await homeworkQuery.range(
    paginationRange.from,
    paginationRange.to,
  );

  if (error) {
    console.error("listHomeworkAssignments failed", {
      error,
      instituteId: institute.id,
      role,
      userId: context.claims.sub,
    });
  }

  return {
    assignments: (data ?? []) as HomeworkAssignmentRow[],
    batches,
    context,
    error: error
      ? "Homework records are unavailable right now. Please try again."
      : queryErrorMessage,
    filters,
    page,
    totalCount: count ?? 0,
  };
}
