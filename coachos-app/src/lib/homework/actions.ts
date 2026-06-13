"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { isDateValue } from "@/lib/dashboard/list-controls";

const HOMEWORK_PATH = "/dashboard/homework";

const homeworkStatuses = ["active", "completed", "archived"] as const;

type HomeworkStatus = (typeof homeworkStatuses)[number];

type HomeworkBatch = {
  branch_id: string;
  id: string;
  institute_id: string;
  name: string;
  subject: string | null;
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
    .select("id, institute_id, branch_id, batch_id, status")
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
    homework: homework as {
      batch_id: string;
      branch_id: string;
      id: string;
      institute_id: string;
      status: HomeworkStatus;
    },
  };
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

  if (dueDate && !isDateValue(dueDate)) {
    redirectWith(next, "error", "Select a valid due date.");
  }

  const { error } = await context.supabase.from("homework_assignments").insert({
    batch_id: batch.id,
    branch_id: batch.branch_id,
    created_by: context.claims.sub,
    description,
    due_date: dueDate,
    institute_id: context.institute.id,
    status,
    subject,
    title,
  });

  if (error) {
    console.error("createHomeworkAssignment failed", {
      batchId: batch.id,
      branchId: batch.branch_id,
      code: error.code,
      details: error.details,
      hint: error.hint,
      instituteId: context.institute.id,
      message: error.message,
      role: context.role,
      userId: context.claims.sub,
    });
    redirectWithSaveError(next);
  }

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework assigned.");
}

export async function updateHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch: currentBatch } = await getHomeworkAssignmentForAction(
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

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework updated.");
}

export async function archiveHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch } = await getHomeworkAssignmentForAction(
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

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework archived.");
}

export async function deleteHomeworkAssignment(formData: FormData) {
  const context = await requireDashboardAccess();
  const next = getSafeNextPath(formData);
  const homeworkId = getRequiredText(formData, "homeworkId", "Homework");
  const { batch } = await getHomeworkAssignmentForAction(
    context,
    homeworkId,
    "homework.delete",
  );

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

  revalidatePath(HOMEWORK_PATH);
  revalidatePath("/dashboard");
  redirectWith(next, "success", "Homework deleted.");
}
