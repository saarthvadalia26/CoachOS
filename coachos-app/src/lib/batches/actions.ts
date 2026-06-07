"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  getDefaultBranchId,
  requireDashboardAccess,
  requireBranchManagerOrOwner,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { needsExplicitBranchSelection } from "@/lib/dashboard/branch-scope";

const BATCHES_PATH = "/dashboard/batches";

function redirectWithError(message: string): never {
  redirect(`${BATCHES_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectWithSaveError(): never {
  redirectWithError(
    "This batch record could not be saved. Please review the details and try again.",
  );
}

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

function getOptionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getTargetBranchId(formData: FormData, context: DashboardContext) {
  const branchId = getOptionalId(formData, "branchId");

  if (!branchId && needsExplicitBranchSelection(context)) {
    redirectWithError("Select a branch before creating a batch.");
  }

  return branchId ?? getDefaultBranchId(context);
}

function requireBranchPermission(
  context: DashboardContext,
  permission: Permission,
  branchId: string | null,
) {
  if (!branchId || !canAccessPermission(context, permission, { branchId })) {
    redirectWithError("You do not have permission to perform this action.");
  }
}

export async function createBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const branchId = getTargetBranchId(formData, context);

  requireBranchPermission(context, "batches.create", branchId);

  const name = getRequiredText(formData, "name", "Batch name");
  const subject = getOptionalText(formData, "subject");
  const schedule = getOptionalText(formData, "schedule");

  const { error } = await supabase.from("batches").insert({
    branch_id: branchId,
    institute_id: institute.id,
    name,
    subject,
    schedule,
  });

  if (error) {
    console.error("createBatch failed", error);
    redirectWithSaveError();
  }

  revalidatePath(BATCHES_PATH);
  revalidatePath("/dashboard");
  redirect(`${BATCHES_PATH}?branchId=${encodeURIComponent(branchId)}`);
}

export async function assignStudentToBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;

  const studentId = getRequiredText(formData, "studentId", "Student");
  const batchId = getRequiredText(formData, "batchId", "Batch");

  const [{ data: student, error: studentError }, { data: batch, error: batchError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id, branch_id")
        .eq("id", studentId)
        .eq("institute_id", institute.id)
        .maybeSingle(),
      supabase
        .from("batches")
        .select("id, branch_id")
        .eq("id", batchId)
        .eq("institute_id", institute.id)
        .maybeSingle(),
    ]);

  if (studentError || batchError) {
    console.error("assignStudentToBatch verification failed", {
      batchError,
      studentError,
    });
    redirectWithError("This batch assignment could not be verified.");
  }

  if (!student || !batch) {
    redirectWithError("Select a student and batch from this institute.");
  }

  if (student.branch_id !== batch.branch_id) {
    redirectWithError("Select a student and batch from the same branch.");
  }

  requireBranchPermission(context, "batches.update", batch.branch_id);

  const { error } = await supabase.from("student_batches").upsert(
    {
      student_id: studentId,
      batch_id: batchId,
    },
    {
      onConflict: "student_id,batch_id",
      ignoreDuplicates: true,
    },
  );

  if (error) {
    console.error("assignStudentToBatch failed", error);
    redirectWithError("The student could not be assigned to this batch.");
  }

  revalidatePath(BATCHES_PATH);
  redirect(`${BATCHES_PATH}?branchId=${encodeURIComponent(batch.branch_id)}`);
}

export async function assignTeacherToBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;

  const batchId = getRequiredText(formData, "batchId", "Batch");
  const membershipId = getRequiredText(formData, "membershipId", "Teacher");

  const [
    { data: batch, error: batchError },
    { data: teacherMembership, error: membershipError },
  ] = await Promise.all([
    supabase
      .from("batches")
      .select("id, branch_id")
      .eq("id", batchId)
      .eq("institute_id", institute.id)
      .maybeSingle(),
    supabase
      .from("memberships")
      .select("id, institute_id, branch_id, role")
      .eq("id", membershipId)
      .eq("institute_id", institute.id)
      .maybeSingle(),
  ]);

  if (batchError || membershipError) {
    console.error("assignTeacherToBatch verification failed", {
      batchError,
      membershipError,
    });
    redirectWithError("This teacher assignment could not be verified.");
  }

  if (!batch || !teacherMembership) {
    redirectWithError("Select a teacher and batch from this institute.");
  }

  if (teacherMembership.role !== "teacher") {
    redirectWithError("Only teacher staff can be assigned to a batch.");
  }

  if (teacherMembership.branch_id !== batch.branch_id) {
    redirectWithError("Select a teacher from the same branch as this batch.");
  }

  await requireBranchManagerOrOwner({ branchId: batch.branch_id });

  const { error } = await supabase.from("batch_teachers").upsert(
    {
      batch_id: batch.id,
      membership_id: teacherMembership.id,
    },
    {
      ignoreDuplicates: true,
      onConflict: "batch_id,membership_id",
    },
  );

  if (error) {
    console.error("assignTeacherToBatch failed", error);
    redirectWithError("The teacher could not be assigned to this batch.");
  }

  revalidatePath(BATCHES_PATH);
  redirect(`${BATCHES_PATH}?branchId=${encodeURIComponent(batch.branch_id)}`);
}

export async function removeTeacherFromBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;

  const batchTeacherId = getRequiredText(
    formData,
    "batchTeacherId",
    "Teacher assignment",
  );

  const { data: batchTeacher, error: batchTeacherError } = await supabase
    .from("batch_teachers")
    .select("id, batch_id, membership_id")
    .eq("id", batchTeacherId)
    .maybeSingle();

  if (batchTeacherError) {
    console.error("removeTeacherFromBatch lookup failed", batchTeacherError);
    redirectWithError("This teacher assignment could not be verified.");
  }

  if (!batchTeacher) {
    redirectWithError("Select a teacher assignment to remove.");
  }

  const { data: batch, error: batchError } = await supabase
    .from("batches")
    .select("id, branch_id")
    .eq("id", batchTeacher.batch_id)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (batchError) {
    console.error("removeTeacherFromBatch batch lookup failed", batchError);
    redirectWithError("This batch record could not be verified.");
  }

  if (!batch) {
    redirectWithError("Select a batch from this institute.");
  }

  await requireBranchManagerOrOwner({ branchId: batch.branch_id });

  const { error } = await supabase
    .from("batch_teachers")
    .delete()
    .eq("id", batchTeacher.id);

  if (error) {
    console.error("removeTeacherFromBatch failed", error);
    redirectWithError("The teacher could not be removed from this batch.");
  }

  revalidatePath(BATCHES_PATH);
  redirect(`${BATCHES_PATH}?branchId=${encodeURIComponent(batch.branch_id)}`);
}

export async function updateBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const batchId = getRequiredText(formData, "batchId", "Batch");
  const name = getRequiredText(formData, "name", "Batch name");
  const subject = getOptionalText(formData, "subject");
  const schedule = getOptionalText(formData, "schedule");

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("batches")
    .select("id, branch_id")
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (existingBatchError) {
    console.error("updateBatch lookup failed", existingBatchError);
    redirectWithSaveError();
  }

  if (!existingBatch) {
    redirectWithError("Select a batch from this institute.");
  }

  requireBranchPermission(context, "batches.update", existingBatch.branch_id);

  const { data: updatedBatch, error } = await supabase
    .from("batches")
    .update({
      name,
      schedule,
      subject,
    })
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateBatch failed", error);
    redirectWithSaveError();
  }

  if (!updatedBatch) {
    redirectWithError("Select a batch from this institute.");
  }

  revalidatePath(BATCHES_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/attendance");
  redirect(
    `${BATCHES_PATH}?branchId=${encodeURIComponent(existingBatch.branch_id)}`,
  );
}

export async function deleteBatch(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const batchId = getRequiredText(formData, "batchId", "Batch");

  const { data: existingBatch, error: existingBatchError } = await supabase
    .from("batches")
    .select("id, branch_id")
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (existingBatchError) {
    console.error("deleteBatch lookup failed", existingBatchError);
    redirectWithError("This batch record could not be deleted. Please try again.");
  }

  if (!existingBatch) {
    redirectWithError("Select a batch from this institute.");
  }

  requireBranchPermission(context, "batches.delete", existingBatch.branch_id);

  const { data: deletedBatch, error } = await supabase
    .from("batches")
    .delete()
    .eq("id", batchId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteBatch failed", error);
    redirectWithError("This batch record could not be deleted. Please try again.");
  }

  if (!deletedBatch) {
    redirectWithError("Select a batch from this institute.");
  }

  revalidatePath(BATCHES_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/attendance");
  redirect(
    `${BATCHES_PATH}?branchId=${encodeURIComponent(existingBatch.branch_id)}`,
  );
}
