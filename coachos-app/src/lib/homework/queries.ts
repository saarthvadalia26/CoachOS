import { redirect } from "next/navigation";

import { requirePermission, type DashboardContext } from "@/lib/auth/permissions";
import {
  getPage,
  getPaginationRange,
  getSearchTerm,
  isDateValue,
} from "@/lib/dashboard/list-controls";

export const homeworkStatuses = ["active", "completed", "archived"] as const;
export const homeworkSubmissionStatuses = [
  "assigned",
  "submitted",
  "checked",
  "late",
  "missing",
  "excused",
] as const;

export type HomeworkStatus = (typeof homeworkStatuses)[number];
export type HomeworkSubmissionStatus =
  (typeof homeworkSubmissionStatuses)[number];

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

export type HomeworkSubmissionSummary = Record<HomeworkSubmissionStatus, number>;

export type HomeworkSubmissionRow = {
  branch_id: string;
  checked_at: string | null;
  checked_by: string | null;
  created_at: string;
  homework_id: string;
  id: string;
  institute_id: string;
  remarks: string | null;
  status: HomeworkSubmissionStatus;
  student: {
    archived_at: string | null;
    full_name: string;
    id: string;
    phone: string | null;
  } | null;
  student_id: string;
  submitted_at: string | null;
  updated_at: string;
};

export type HomeworkListParams = {
  batchId?: string;
  branchId?: string;
  dueDate?: string;
  page?: string;
  q?: string;
  status?: string;
  submissionStatus?: string;
};

function getSelectedAssignmentStatus(
  value: string | null | undefined,
): "" | HomeworkStatus {
  if (homeworkStatuses.includes(value as HomeworkStatus)) {
    return value as HomeworkStatus;
  }

  return "";
}

function getSelectedSubmissionStatus(
  value: string | null | undefined,
): "" | HomeworkSubmissionStatus {
  if (homeworkSubmissionStatuses.includes(value as HomeworkSubmissionStatus)) {
    return value as HomeworkSubmissionStatus;
  }

  return "";
}

export function createEmptySubmissionSummary(): HomeworkSubmissionSummary {
  return {
    assigned: 0,
    checked: 0,
    excused: 0,
    late: 0,
    missing: 0,
    submitted: 0,
  };
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

function getEmptyListResult({
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
    submissionStatus: "" | HomeworkSubmissionStatus;
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
    submissionSummaryByHomeworkId: new Map<string, HomeworkSubmissionSummary>(),
    totalCount: 0,
  };
}

async function getBatchesForHomeworkList({
  context,
  selectedBranchId,
  teacherBatchIds,
  visibleBranchIds,
}: {
  context: DashboardContext;
  selectedBranchId: string | null;
  teacherBatchIds: string[] | null;
  visibleBranchIds: string[];
}) {
  let batchesQuery = context.supabase
    .from("batches")
    .select("id, branch_id, name, subject")
    .eq("institute_id", context.institute.id)
    .order("name", { ascending: true });

  if (selectedBranchId) {
    batchesQuery = batchesQuery.eq("branch_id", selectedBranchId);
  } else if (visibleBranchIds.length) {
    batchesQuery = batchesQuery.in("branch_id", visibleBranchIds);
  }

  if (teacherBatchIds) {
    if (!teacherBatchIds.length) {
      return {
        batches: [] as HomeworkBatchOption[],
        error: null,
      };
    }

    batchesQuery = batchesQuery.in("id", teacherBatchIds);
  }

  const { data, error } = await batchesQuery;

  if (error) {
    console.error("listHomeworkAssignments batches failed", {
      error,
      instituteId: context.institute.id,
      role: context.role,
      userId: context.claims.sub,
    });
  }

  return {
    batches: (data ?? []) as HomeworkBatchOption[],
    error,
  };
}

async function getHomeworkIdsForSubmissionStatus({
  context,
  selectedSubmissionStatus,
  visibleBranchIds,
}: {
  context: DashboardContext;
  selectedSubmissionStatus: HomeworkSubmissionStatus;
  visibleBranchIds: string[];
}) {
  let query = context.supabase
    .from("homework_submissions")
    .select("homework_id")
    .eq("institute_id", context.institute.id)
    .eq("status", selectedSubmissionStatus);

  if (visibleBranchIds.length) {
    query = query.in("branch_id", visibleBranchIds);
  }

  const { data, error } = await query;

  if (error) {
    console.error("homework submission status filter failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    return {
      error,
      homeworkIds: [] as string[],
    };
  }

  return {
    error: null,
    homeworkIds: Array.from(
      new Set((data ?? []).map((row) => row.homework_id).filter(Boolean)),
    ) as string[],
  };
}

async function getSubmissionSummariesForHomeworkIds(
  context: DashboardContext,
  homeworkIds: string[],
) {
  const summaryByHomeworkId = new Map<string, HomeworkSubmissionSummary>();

  for (const homeworkId of homeworkIds) {
    summaryByHomeworkId.set(homeworkId, createEmptySubmissionSummary());
  }

  if (!homeworkIds.length) {
    return summaryByHomeworkId;
  }

  const { data, error } = await context.supabase
    .from("homework_submissions")
    .select("homework_id, status")
    .in("homework_id", homeworkIds)
    .eq("institute_id", context.institute.id);

  if (error) {
    console.error("homework submission summary failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkCount: homeworkIds.length,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    return summaryByHomeworkId;
  }

  for (const row of data ?? []) {
    const status = row.status as HomeworkSubmissionStatus;
    const summary =
      summaryByHomeworkId.get(row.homework_id) ??
      createEmptySubmissionSummary();

    if (homeworkSubmissionStatuses.includes(status)) {
      summary[status] += 1;
    }

    summaryByHomeworkId.set(row.homework_id, summary);
  }

  return summaryByHomeworkId;
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
  const selectedStatus = getSelectedAssignmentStatus(params.status);
  const selectedSubmissionStatus = getSelectedSubmissionStatus(
    params.submissionStatus,
  );
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
    submissionStatus: selectedSubmissionStatus,
  };
  const { batches, error: batchesError } = await getBatchesForHomeworkList({
    context,
    selectedBranchId,
    teacherBatchIds,
    visibleBranchIds,
  });
  const allowedBatchIds = batches.map((batch) => batch.id);
  const queryErrorMessage = batchesError
    ? "Homework records are unavailable right now. Please try again."
    : null;

  if (selectedBatchId && !allowedBatchIds.includes(selectedBatchId)) {
    return getEmptyListResult({
      batches,
      context,
      error: queryErrorMessage,
      filters,
      page,
    });
  }

  if (!allowedBatchIds.length) {
    return getEmptyListResult({
      batches,
      context,
      error: queryErrorMessage,
      filters,
      page,
    });
  }

  let submissionStatusHomeworkIds: string[] | null = null;

  if (selectedSubmissionStatus) {
    const submissionStatusFilter = await getHomeworkIdsForSubmissionStatus({
      context,
      selectedSubmissionStatus,
      visibleBranchIds,
    });

    if (submissionStatusFilter.error) {
      return getEmptyListResult({
        batches,
        context,
        error: "Homework records are unavailable right now. Please try again.",
        filters,
        page,
      });
    }

    submissionStatusHomeworkIds = submissionStatusFilter.homeworkIds;

    if (!submissionStatusHomeworkIds.length) {
      return getEmptyListResult({
        batches,
        context,
        error: queryErrorMessage,
        filters,
        page,
      });
    }
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

  if (submissionStatusHomeworkIds) {
    homeworkQuery = homeworkQuery.in("id", submissionStatusHomeworkIds);
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

  const assignments = (data ?? []) as HomeworkAssignmentRow[];
  const submissionSummaryByHomeworkId =
    await getSubmissionSummariesForHomeworkIds(
      context,
      assignments.map((homework) => homework.id),
    );

  return {
    assignments,
    batches,
    context,
    error: error
      ? "Homework records are unavailable right now. Please try again."
      : queryErrorMessage,
    filters,
    page,
    submissionSummaryByHomeworkId,
    totalCount: count ?? 0,
  };
}

export async function listHomeworkSubmissions(homeworkId: string) {
  const context = await requirePermission("homework.view");
  const { data: homeworkRow, error: homeworkError } = await context.supabase
    .from("homework_assignments")
    .select(
      "id, institute_id, branch_id, batch_id, title, description, subject, due_date, status, created_by, created_at, updated_at",
    )
    .eq("id", homeworkId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (homeworkError) {
    console.error("listHomeworkSubmissions homework lookup failed", {
      code: homeworkError.code,
      details: homeworkError.details,
      hint: homeworkError.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: homeworkError.message,
      role: context.role,
      userId: context.claims.sub,
    });
  }

  if (!homeworkRow) {
    redirect("/dashboard/access-denied");
  }

  const homework = homeworkRow as HomeworkAssignmentRow;
  const [
    { data: batchRow, error: batchError },
    { data: submissionRows, error: submissionsError },
  ] = await Promise.all([
    context.supabase
      .from("batches")
      .select("id, branch_id, name, subject")
      .eq("id", homework.batch_id)
      .eq("institute_id", context.institute.id)
      .maybeSingle(),
    context.supabase
      .from("homework_submissions")
      .select(
        "id, institute_id, branch_id, homework_id, student_id, status, submitted_at, checked_at, checked_by, remarks, created_at, updated_at",
      )
      .eq("homework_id", homework.id)
      .eq("institute_id", context.institute.id)
      .order("created_at", { ascending: true }),
  ]);

  if (batchError || submissionsError) {
    console.error("listHomeworkSubmissions detail failed", {
      batchError,
      homeworkId,
      instituteId: context.institute.id,
      role: context.role,
      submissionsError,
      userId: context.claims.sub,
    });
  }

  const submissionsWithoutStudent = (submissionRows ?? []) as Array<
    Omit<HomeworkSubmissionRow, "student">
  >;
  const studentIds = submissionsWithoutStudent.map(
    (submission) => submission.student_id,
  );
  const studentsById = new Map<
    string,
    HomeworkSubmissionRow["student"]
  >();

  if (studentIds.length) {
    const { data: studentRows, error: studentsError } = await context.supabase
      .from("students")
      .select("id, full_name, phone, archived_at")
      .in("id", studentIds)
      .eq("institute_id", context.institute.id);

    if (studentsError) {
      console.error("listHomeworkSubmissions students failed", {
        code: studentsError.code,
        details: studentsError.details,
        hint: studentsError.hint,
        homeworkId,
        instituteId: context.institute.id,
        message: studentsError.message,
        role: context.role,
        userId: context.claims.sub,
      });
    }

    for (const student of studentRows ?? []) {
      studentsById.set(student.id, student);
    }
  }

  let createdByName: string | null = null;

  if (homework.created_by) {
    if (homework.created_by === context.claims.sub) {
      createdByName = context.profile.full_name ?? context.claims.email ?? null;
    } else {
      const { data: staffMember } = await context.supabase
        .from("staff_members")
        .select("full_name")
        .eq("institute_id", context.institute.id)
        .eq("auth_user_id", homework.created_by)
        .maybeSingle();

      createdByName = staffMember?.full_name ?? null;
    }
  }

  const submissions = submissionsWithoutStudent.map((submission) => ({
    ...submission,
    student: studentsById.get(submission.student_id) ?? null,
  }));
  const summary = createEmptySubmissionSummary();

  for (const submission of submissions) {
    summary[submission.status] += 1;
  }

  return {
    batch: (batchRow ?? null) as HomeworkBatchOption | null,
    context,
    createdByName,
    error:
      homeworkError || batchError || submissionsError
        ? "Homework submissions are unavailable right now. Please try again."
        : null,
    homework,
    submissions,
    summary,
  };
}
