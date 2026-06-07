"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  getDefaultBranchId,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";
import { needsExplicitBranchSelection } from "@/lib/dashboard/branch-scope";

const STUDENTS_PATH = "/dashboard/students";

function redirectWithError(message: string): never {
  redirect(`${STUDENTS_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectWithSaveError(): never {
  redirectWithError(
    "This student record could not be saved. Please review the details and try again.",
  );
}

function getRequiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirectWithError("Student name is required.");
  }

  return value;
}

function getRequiredId(formData: FormData, key: string, label: string) {
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
    redirectWithError("Select a branch before creating a student.");
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

export async function createStudent(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const branchId = getTargetBranchId(formData, context);

  requireBranchPermission(context, "students.create", branchId);

  const fullName = getRequiredText(formData, "fullName");
  const phone = getOptionalText(formData, "phone");
  const parentPhone = getOptionalText(formData, "parentPhone");

  const { error } = await supabase.from("students").insert({
    branch_id: branchId,
    institute_id: institute.id,
    full_name: fullName,
    phone,
    parent_phone: parentPhone,
  });

  if (error) {
    console.error("createStudent failed", error);
    redirectWithSaveError();
  }

  revalidatePath(STUDENTS_PATH);
  revalidatePath("/dashboard");
  redirect(`${STUDENTS_PATH}?branchId=${encodeURIComponent(branchId)}`);
}

export async function updateStudent(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const studentId = getRequiredId(formData, "studentId", "Student");
  const fullName = getRequiredText(formData, "fullName");
  const phone = getOptionalText(formData, "phone");
  const parentPhone = getOptionalText(formData, "parentPhone");
  const status = getOptionalText(formData, "status") ?? "active";

  const { data: existingStudent, error: existingStudentError } = await supabase
    .from("students")
    .select("id, branch_id")
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (existingStudentError) {
    console.error("updateStudent lookup failed", existingStudentError);
    redirectWithSaveError();
  }

  if (!existingStudent) {
    redirectWithError("Select a student from this institute.");
  }

  requireBranchPermission(context, "students.update", existingStudent.branch_id);

  const { data: updatedStudent, error } = await supabase
    .from("students")
    .update({
      full_name: fullName,
      parent_phone: parentPhone,
      phone,
      status,
    })
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateStudent failed", error);
    redirectWithSaveError();
  }

  if (!updatedStudent) {
    redirectWithError("Select a student from this institute.");
  }

  revalidatePath(STUDENTS_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/fees");
  redirect(
    `${STUDENTS_PATH}?branchId=${encodeURIComponent(existingStudent.branch_id)}`,
  );
}

export async function deleteStudent(formData: FormData) {
  const context = await requireDashboardAccess();
  const { supabase, institute } = context;
  const studentId = getRequiredId(formData, "studentId", "Student");

  const { data: existingStudent, error: existingStudentError } = await supabase
    .from("students")
    .select("id, branch_id")
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .maybeSingle();

  if (existingStudentError) {
    console.error("deleteStudent lookup failed", existingStudentError);
    redirectWithError("This student record could not be deleted. Please try again.");
  }

  if (!existingStudent) {
    redirectWithError("Select a student from this institute.");
  }

  requireBranchPermission(context, "students.delete", existingStudent.branch_id);

  const { data: deletedStudent, error } = await supabase
    .from("students")
    .delete()
    .eq("id", studentId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteStudent failed", error);
    redirectWithError("This student record could not be deleted. Please try again.");
  }

  if (!deletedStudent) {
    redirectWithError("Select a student from this institute.");
  }

  revalidatePath(STUDENTS_PATH);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/batches");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/fees");
  redirect(
    `${STUDENTS_PATH}?branchId=${encodeURIComponent(existingStudent.branch_id)}`,
  );
}
