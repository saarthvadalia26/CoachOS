"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/log";
import {
  canAccessPermission,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { isDateValue } from "@/lib/dashboard/list-controls";

const HOMEWORK_PATH = "/dashboard/homework";

const homeworkStatuses = ["active", "completed", "archived"] as const;
const submissionStatuses = [
  "assigned",
  "submitted",
  "checked",
  "late",
  "missing",
  "excused",
] as const;

type HomeworkStatus = (typeof homeworkStatuses)[number];
type HomeworkSubmissionStatus = (typeof submissionStatuses)[number];

type HomeworkBatch = {
  branch_id: string;
  id: string;
  institute_id: string;
  name: string;
  subject: string | null;
};

type HomeworkForAction = {
  batch_id: string;
  branch_id: string;
  id: string;
  institute_id: string;
  status: HomeworkStatus;
  title: string;
};

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirectWithError(`${label} is required.`);
  }

  return value;
}

function getOptionalText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getSafeNextPath(formData: FormData) {
  const next = String(formData.get("next") ?? "").trim();

  if (next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return HOMEWORK_PATH;
}

function redirectWith(path: string, key: "error" | "success", message: string): never {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);

  params.set(key, message);
  redirect(`${pathname}?${params.toString()}`);
}

function redirectWithError(message: string): never {
  redirectWith(HOMEWORK_PATH, "error", message);
}

function redirectWithSaveError(path = HOMEWORK_PATH): never {
  redirectWith(path, "error", "Could not save homework. Please try again.");
}

function parseStatus(value: string | null, fallback: HomeworkStatus) {
  if (!value) {
    return fallback;
  }

  if (homeworkStatuses.includes(value as HomeworkStatus)) {
    return value as HomeworkStatus;
  }

  redirectWithError("Select a valid homework status.");
}

function parseSubmissionStatus(value: string | null): HomeworkSubmissionStatus {
  if (submissionStatuses.includes(value as HomeworkSubmissionStatus)) {
    return value as HomeworkSubmissionStatus;
  }

  redirectWithError("Select a valid submission status.");
}

function canUseBranchPermission(
  context: DashboardContext,
  permission: Permission,
  branchId: string,
) {
  return canAccessPermission(context, permission, { branchId });
}

async function isTeacherAssignedToBatch(
  context: DashboardContext,
  batchId: string,
) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return false;
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("id")
    .eq("batch_id", batchId)
    .in("membership_id", teacherMembershipIds)
    .limit(1);

  if (error) {
    console.error("homework teacher assignment check failed", {
      batchId,
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    return false;
  }

  return Boolean(data?.length);
}

async function canUseHomeworkBatch(
  context: DashboardContext,
  batch: Pick<HomeworkBatch, "branch_id" | "id">,
  permission: Permission,
) {
  if (context.role === "teacher") {
    if (
      !["homework.view", "homework.create", "homework.update"].includes(
        permission,
      )
    ) {
      return false;
    }

    return isTeacherAssignedToBatch(context, batch.id);
  }

  return canUseBranchPermission(context, permission, batch.branch_id);
}

async function getBatchForHomework(
  context: DashboardContext,
  batchId: string,
  permission: Permission,
) {
  const { data: batch, error } = await context.supabase
    .from("batches")
    .select("id, institute_id, branch_id, name, subject")
    .eq("id", batchId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error) {
    console.error("homework batch lookup failed", {
      batchId,
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError();
  }

  if (!batch) {
    redirectWithError("Select a batch from this institute.");
  }

  const homeworkBatch = batch as HomeworkBatch;

  if (!(await canUseHomeworkBatch(context, homeworkBatch, permission))) {
    redirectWithError("You do not have permission to perform this action.");
  }

  return homeworkBatch;
}

async function getHomeworkAssignmentForAction(
  context: DashboardContext,
  homeworkId: string,
  permission: Permission,
) {
  const { data: homework, error } = await context.supabase
    .from("homework_assignments")
    .select("id, institute_id, branch_id, batch_id, status, title")
    .eq("id", homeworkId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error) {
    console.error("homework assignment lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError();
  }

  if (!homework) {
    redirectWithError("Select a homework assignment from this institute.");
  }

  const { data: batch, error: batchError } = await context.supabase
    .from("batches")
    .select("id, institute_id, branch_id, name, subject")
    .eq("id", homework.batch_id)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (batchError) {
    console.error("homework assignment batch lookup failed", {
      batchError,
      homeworkId,
      instituteId: context.institute.id,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError();
  }

  if (!batch) {
    redirectWithError("Select a homework assignment with a valid batch.");
  }

  const homeworkBatch = batch as HomeworkBatch;

  if (!(await canUseHomeworkBatch(context, homeworkBatch, permission))) {
    redirectWithError("You do not have permission to perform this action.");
  }

  return {
    batch: homeworkBatch,
    homework: homework as HomeworkForAction,
  };
}

async function getHomeworkSubmissionForAction(
  context: DashboardContext,
  submissionId: string,
  permission: Permission,
) {
  const { data: submission, error } = await context.supabase
    .from("homework_submissions")
    .select("id, institute_id, branch_id, homework_id, student_id, status")
    .eq("id", submissionId)
    .eq("institute_id", context.institute.id)
    .maybeSingle();

  if (error) {
    console.error("homework submission lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      submissionId,
      userId: context.claims.sub,
    });
    redirectWithSaveError();
  }

  if (!submission) {
    redirectWithError("Select a homework submission from this institute.");
  }

  const { batch, homework } = await getHomeworkAssignmentForAction(
    context,
    submission.homework_id,
    permission,
  );

  return {
    batch,
    homework,
    submission: submission as {
      branch_id: string;
      homework_id: string;
      id: string;
      institute_id: string;
      status: HomeworkSubmissionStatus;
      student_id: string;
    },
  };
}

async function createMissingSubmissionsForHomework(
  context: DashboardContext,
  homework: HomeworkForAction,
  redirectPath = `/dashboard/homework/${homework.id}`,
) {
  const { data: studentBatchRows, error: studentBatchError } =
    await context.supabase
      .from("student_batches")
      .select("student_id")
      .eq("batch_id", homework.batch_id);

  if (studentBatchError) {
    console.error("homework submission sync student batch lookup failed", {
      code: studentBatchError.code,
      details: studentBatchError.details,
      hint: studentBatchError.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: studentBatchError.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError(redirectPath);
  }

  const studentIds = Array.from(
    new Set(
      (studentBatchRows ?? [])
        .map((row) => row.student_id)
        .filter(Boolean),
    ),
  ) as string[];

  if (!studentIds.length) {
    console.log("[createHomeworkAssignment DEBUG] active batch students query count (from student_batches)", 0);
    return 0;
  }

  const { data: studentRows, error: studentsError } = await context.supabase
    .from("students")
    .select("id, archived_at, status")
    .eq("institute_id", homework.institute_id)
    .eq("branch_id", homework.branch_id)
    .in("id", studentIds);

  if (studentsError) {
    console.error("homework submission sync student lookup failed", {
      code: studentsError.code,
      details: studentsError.details,
      hint: studentsError.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: studentsError.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError(redirectPath);
  }

  const activeStudentIds = (studentRows ?? [])
    .filter((student) => student.archived_at === null && student.status !== "archived")
    .map((student) => student.id);

  console.log("[createHomeworkAssignment DEBUG] active batch students query count", activeStudentIds.length);

  if (!activeStudentIds.length) {
    return 0;
  }

  const submissionRows = activeStudentIds.map((studentId) => ({
    branch_id: homework.branch_id,
    homework_id: homework.id,
    institute_id: homework.institute_id,
    status: "assigned",
    student_id: studentId,
  }));

  const { error } = await context.supabase
    .from("homework_submissions")
    .upsert(submissionRows, {
      ignoreDuplicates: true,
      onConflict: "homework_id,student_id",
    });

  if (error) {
    console.error("homework submission sync failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    console.log("[createHomeworkAssignment DEBUG] homework_submissions insert error", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    redirectWithSaveError(redirectPath);
  }

  return submissionRows.length;
}

export async function createHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const batchId = getRequiredText(formData, "batchId", "Batch");
  const requestedBranchId = getOptionalText(formData, "branchId");
  const batch = await getBatchForHomework(context, batchId, "homework.create");

  if (requestedBranchId && requestedBranchId !== batch.branch_id) {
    redirectWith(next, "error", "Select a batch from the selected branch.");
  }

  const title = getRequiredText(formData, "title", "Homework title");
  const description = getOptionalText(formData, "description");
  const subject = getOptionalText(formData, "subject") ?? batch.subject;
  const dueDate = getOptionalText(formData, "dueDate");
  const status = parseStatus(getOptionalText(formData, "status"), "active");

  console.log("[createHomeworkAssignment DEBUG]", {
    userId: context.claims.sub,
    resolvedRole: context.role,
    selectedBatchId: batchId,
    selectedBranchId: requestedBranchId,
    derivedBranchId: batch.branch_id,
    derivedInstituteId: batch.institute_id,
    title,
    subject,
    dueDate,
    status,
  });

  if (dueDate && !isDateValue(dueDate)) {
    redirectWith(next, "error", "Select a valid due date.");
  }

  const { data: homework, error } = await context.supabase
    .from("homework_assignments")
    .insert({
      batch_id: batch.id,
      branch_id: batch.branch_id,
      created_by: context.claims.sub,
      description,
      due_date: dueDate,
      institute_id: batch.institute_id,
      status,
      subject,
      title,
    })
    .select("id, institute_id, branch_id, batch_id, status, title")
    .single();

  if (error) {
    console.error("createHomeworkAssignment failed", {
      batchId: batch.id,
      branchId: batch.branch_id,
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: batch.institute_id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    console.log("[createHomeworkAssignment DEBUG] homework_assignments insert error", {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    redirectWithSaveError(next);
  }

  console.log("[createHomeworkAssignment DEBUG] created homework id", homework.id);

  const submissionCount = await createMissingSubmissionsForHomework(
    context,
    homework as HomeworkForAction,
    next,
  );

  console.log("[createHomeworkAssignment DEBUG] final returned action state", {
    success: true,
    submissionCount,
  });

  await logActivity(context, {
    action: "homework.created",
    branchId: batch.branch_id,
    description: "Homework assigned to a batch.",
    entityId: homework.id,
    entityLabel: title,
    entityType: "homework",
    metadata: {
      batchId: batch.id,
      submissionCount,
    },
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");

  if (submissionCount === 0) {
    redirectWith(
      next,
      "success",
      "Homework created. No active students are assigned to this batch yet."
    );
  } else {
    redirectWith(next, "success", "Homework assigned.");
  }
}

export async function updateHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch: currentBatch, homework } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.update",
  );
  const requestedBatchId = getOptionalText(formData, "batchId");
  const nextBatch = requestedBatchId
    ? await getBatchForHomework(context, requestedBatchId, "homework.update")
    : currentBatch;
  const requestedBranchId = getOptionalText(formData, "branchId");

  if (requestedBranchId && requestedBranchId !== nextBatch.branch_id) {
    redirectWith(next, "error", "Select a batch from the selected branch.");
  }

  if (nextBatch.id !== currentBatch.id) {
    const { count, error: submissionCountError } = await context.supabase
      .from("homework_submissions")
      .select("id", { count: "exact", head: true })
      .eq("homework_id", homework.id)
      .eq("institute_id", context.institute.id);

    if (submissionCountError) {
      console.error("updateHomeworkAssignment submission count failed", {
        code: submissionCountError.code,
        details: submissionCountError.details,
        hint: submissionCountError.hint,
        homeworkId,
        instituteId: context.institute.id,
        message: submissionCountError.message,
        role: context.role,
        userId: context.claims.sub,
      });
      redirectWithSaveError(next);
    }

    if ((count ?? 0) > 0) {
      redirectWith(
        next,
        "error",
        "This homework already has student submissions. Archive it and create a new assignment for a different batch.",
      );
    }
  }

  const title = getRequiredText(formData, "title", "Homework title");
  const description = getOptionalText(formData, "description");
  const subject = getOptionalText(formData, "subject") ?? nextBatch.subject;
  const dueDate = getOptionalText(formData, "dueDate");
  const status = parseStatus(getOptionalText(formData, "status"), "active");

  if (dueDate && !isDateValue(dueDate)) {
    redirectWith(next, "error", "Select a valid due date.");
  }

  const { data: updatedHomework, error } = await context.supabase
    .from("homework_assignments")
    .update({
      batch_id: nextBatch.id,
      branch_id: nextBatch.branch_id,
      description,
      due_date: dueDate,
      institute_id: context.institute.id,
      status,
      subject,
      title,
    })
    .eq("id", homeworkId)
    .eq("institute_id", context.institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateHomeworkAssignment failed", {
      branchId: nextBatch.branch_id,
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError(next);
  }

  if (!updatedHomework) {
    redirectWith(next, "error", "Select a homework assignment from this institute.");
  }

  await logActivity(context, {
    action: "homework.updated",
    branchId: nextBatch.branch_id,
    description: "Homework details updated.",
    entityId: homeworkId,
    entityLabel: title,
    entityType: "homework",
    metadata: {
      batchId: nextBatch.id,
      status,
    },
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework updated.");
}

export async function archiveHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch, homework } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.archive",
  );

  const { data: archivedHomework, error } = await context.supabase
    .from("homework_assignments")
    .update({ status: "archived" })
    .eq("id", homeworkId)
    .eq("institute_id", context.institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("archiveHomeworkAssignment failed", {
      branchId: batch.branch_id,
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not archive homework. Please try again.");
  }

  if (!archivedHomework) {
    redirectWith(next, "error", "Select a homework assignment from this institute.");
  }

  await logActivity(context, {
    action: "homework.archived",
    branchId: batch.branch_id,
    description: "Homework archived.",
    entityId: homeworkId,
    entityLabel: homework.title,
    entityType: "homework",
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework archived.");
}

export async function deleteHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch, homework } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.delete",
  );
  const { count: submissionCount, error: submissionCountError } =
    await context.supabase
      .from("homework_submissions")
      .select("id", { count: "exact", head: true })
      .eq("homework_id", homeworkId)
      .eq("institute_id", context.institute.id);

  if (submissionCountError) {
    console.error("deleteHomeworkAssignment submission count failed", {
      branchId: batch.branch_id,
      code: submissionCountError.code,
      details: submissionCountError.details,
      hint: submissionCountError.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: submissionCountError.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not delete homework. Please try again.");
  }

  if ((submissionCount ?? 0) > 0) {
    redirectWith(
      next,
      "error",
      "This homework has student submission history. Archive it instead.",
    );
  }

  const { data: deletedHomework, error } = await context.supabase
    .from("homework_assignments")
    .delete()
    .eq("id", homeworkId)
    .eq("institute_id", context.institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteHomeworkAssignment failed", {
      branchId: batch.branch_id,
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not delete homework. Please try again.");
  }

  if (!deletedHomework) {
    redirectWith(next, "error", "Select a homework assignment from this institute.");
  }

  await logActivity(context, {
    action: "homework.deleted",
    branchId: batch.branch_id,
    description: "Homework deleted.",
    entityId: homeworkId,
    entityLabel: homework.title,
    entityType: "homework",
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework deleted.");
}

export async function updateHomeworkSubmissionStatus(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const submissionId = getRequiredText(
    formData,
    "submissionId",
    "Submission",
  );
  const status = parseSubmissionStatus(getOptionalText(formData, "status"));
  const remarks = getOptionalText(formData, "remarks");
  const { homework, submission } = await getHomeworkSubmissionForAction(
    context,
    submissionId,
    "homework.update",
  );
  const now = new Date().toISOString();
  const updatePayload: {
    checked_at?: string | null;
    checked_by?: string | null;
    remarks?: string | null;
    status: HomeworkSubmissionStatus;
    submitted_at?: string | null;
  } = {
    status,
  };

  if (remarks !== null) {
    updatePayload.remarks = remarks;
  }

  if (status === "submitted" || status === "late") {
    updatePayload.submitted_at = now;
  }

  if (status === "checked") {
    updatePayload.checked_at = now;
    updatePayload.checked_by = context.claims.sub;
  }

  const { data: updatedSubmission, error } = await context.supabase
    .from("homework_submissions")
    .update(updatePayload)
    .eq("id", submissionId)
    .eq("institute_id", context.institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateHomeworkSubmissionStatus failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      submissionId,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not update submission. Please try again.");
  }

  if (!updatedSubmission) {
    redirectWith(next, "error", "Select a homework submission from this institute.");
  }

  await logActivity(context, {
    action: "homework.submission_updated",
    branchId: homework.branch_id,
    description: "Homework submission status updated.",
    entityId: homework.id,
    entityLabel: homework.title,
    entityType: "homework",
    metadata: {
      status,
      studentId: submission.student_id,
    },
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath(`/dashboard/homework/${homework.id}`);
  redirectWith(next, "success", "Submission updated.");
}

export async function updateHomeworkSubmissionRemarks(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const submissionId = getRequiredText(
    formData,
    "submissionId",
    "Submission",
  );
  const remarks = getOptionalText(formData, "remarks");
  const { homework, submission } = await getHomeworkSubmissionForAction(
    context,
    submissionId,
    "homework.update",
  );

  const { data: updatedSubmission, error } = await context.supabase
    .from("homework_submissions")
    .update({ remarks })
    .eq("id", submissionId)
    .eq("institute_id", context.institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateHomeworkSubmissionRemarks failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      submissionId,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not update submission. Please try again.");
  }

  if (!updatedSubmission) {
    redirectWith(next, "error", "Select a homework submission from this institute.");
  }

  await logActivity(context, {
    action: "homework.submission_updated",
    branchId: homework.branch_id,
    description: "Homework submission remarks updated.",
    entityId: homework.id,
    entityLabel: homework.title,
    entityType: "homework",
    metadata: {
      studentId: submission.student_id,
    },
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath(`/dashboard/homework/${homework.id}`);
  redirectWith(next, "success", "Submission updated.");
}

export async function bulkUpdateHomeworkSubmissions(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const status = parseSubmissionStatus(getOptionalText(formData, "status"));
  const submissionIds = formData
    .getAll("submissionId")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!submissionIds.length) {
    redirectWith(next, "error", "Select at least one student submission.");
  }

  const { homework } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.update",
  );
  const now = new Date().toISOString();
  const updatePayload: {
    checked_at?: string | null;
    checked_by?: string | null;
    status: HomeworkSubmissionStatus;
    submitted_at?: string | null;
  } = {
    status,
  };

  if (status === "submitted" || status === "late") {
    updatePayload.submitted_at = now;
  }

  if (status === "checked") {
    updatePayload.checked_at = now;
    updatePayload.checked_by = context.claims.sub;
  }

  const { error } = await context.supabase
    .from("homework_submissions")
    .update(updatePayload)
    .eq("homework_id", homework.id)
    .eq("institute_id", context.institute.id)
    .in("id", submissionIds);

  if (error) {
    console.error("bulkUpdateHomeworkSubmissions failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      homeworkId: homework.id,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      submissionCount: submissionIds.length,
      userId: context.claims.sub,
    });
    redirectWith(next, "error", "Could not update submission. Please try again.");
  }

  await logActivity(context, {
    action: "homework.submission_updated",
    branchId: homework.branch_id,
    description: "Homework submissions updated.",
    entityId: homework.id,
    entityLabel: homework.title,
    entityType: "homework",
    metadata: {
      status,
      submissionCount: submissionIds.length,
    },
  });

  revalidatePath(HOMEWORK_PATH);
  revalidatePath(`/dashboard/homework/${homework.id}`);
  redirectWith(next, "success", "Submissions updated.");
}

export async function syncHomeworkSubmissionsForBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { homework } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.update",
  );

  await createMissingSubmissionsForHomework(context, homework);

  revalidatePath(HOMEWORK_PATH);
  revalidatePath(`/dashboard/homework/${homework.id}`);
  redirectWith(next, "success", "Students synced.");
}
