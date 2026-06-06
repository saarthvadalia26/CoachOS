"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  requireOwner,
  type DashboardContext,
  type Permission,
} from "@/lib/auth/permissions";

const ACADEMIC_YEARS_PATH = "/dashboard/settings/academic-years";

function redirectWithError(message: string): never {
  redirect(`${ACADEMIC_YEARS_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectWithSaveError(): never {
  redirectWithError("Could not save the academic year. Please try again.");
}

function redirectWithDeleteError(): never {
  redirectWithError("Could not delete the academic year. Please try again.");
}

function redirectWithLinkedAttendanceError(): never {
  redirectWithError(
    "This academic year has attendance records and cannot be deleted.",
  );
}

function redirectWithDuplicateNameError(): never {
  redirectWithError("An academic year with this name already exists.");
}

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: undefined,
      details: undefined,
      hint: undefined,
      message: undefined,
    };
  }

  const supabaseError = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  };

  return {
    code: supabaseError.code,
    details: supabaseError.details,
    hint: supabaseError.hint,
    message: supabaseError.message,
  };
}

function isLinkedAttendanceDeleteError(error: unknown) {
  return (
    getSupabaseErrorDetails(error).message ===
    "This academic year has attendance records and cannot be deleted."
  );
}

function isDuplicateAcademicYearNameError(error: unknown) {
  const details = getSupabaseErrorDetails(error);

  return (
    details.code === "23505" &&
    (details.message?.includes("academic_years_institute_id_lower_name_idx") ||
      details.details?.includes("academic_years_institute_id_lower_name_idx"))
  );
}

function logAcademicYearError(
  operation: string,
  context: DashboardContext,
  error: unknown,
) {
  console.error("academic year action failed", {
    institute_id: context.institute.id,
    membership_id: context.currentMembership.id,
    operation,
    role: context.role,
    supabase_error: getSupabaseErrorDetails(error),
    user_id: context.claims.sub,
  });
}

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirectWithError(`${label} is required.`);
  }

  return value;
}

function getRequiredDate(formData: FormData, key: string, label: string) {
  const value = getRequiredText(formData, key, label);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    redirectWithError(`${label} must be a valid date.`);
  }

  return value;
}

function validateDateRange(startDate: string, endDate: string) {
  if (startDate >= endDate) {
    redirectWithError("Start date must be before end date.");
  }
}

async function requireAcademicYearOwnerPermission(permission: Permission) {
  const context = await requireOwner();

  if (
    !canAccessPermission(context, permission, {
      instituteId: context.institute.id,
    })
  ) {
    redirect("/dashboard/access-denied");
  }

  return context;
}

async function ensureAcademicYearNameIsUnique(
  context: DashboardContext,
  name: string,
  currentAcademicYearId?: string,
) {
  const normalizedName = name.trim().toLowerCase();
  const { data: academicYears, error } = await context.supabase
    .from("academic_years")
    .select("id, name")
    .eq("institute_id", context.institute.id);

  if (error) {
    logAcademicYearError("check duplicate academic year name", context, error);
    redirectWithSaveError();
  }

  const duplicateAcademicYear = (academicYears ?? []).find(
    (academicYear) =>
      academicYear.id !== currentAcademicYearId &&
      String(academicYear.name ?? "").trim().toLowerCase() === normalizedName,
  );

  if (duplicateAcademicYear) {
    redirectWithDuplicateNameError();
  }
}

export async function createAcademicYear(formData: FormData) {
  const context = await requireAcademicYearOwnerPermission(
    "academic_years.create",
  );
  const { institute, supabase } = context;
  const name = getRequiredText(formData, "name", "Academic year name");
  const startDate = getRequiredDate(formData, "startDate", "Start date");
  const endDate = getRequiredDate(formData, "endDate", "End date");
  const shouldSetActive = formData.get("isActive") === "on";

  validateDateRange(startDate, endDate);
  await ensureAcademicYearNameIsUnique(context, name);

  const { data: academicYear, error } = await supabase
    .from("academic_years")
    .insert({
      end_date: endDate,
      institute_id: institute.id,
      is_active: false,
      name,
      start_date: startDate,
    })
    .select("id")
    .maybeSingle();

  if (error || !academicYear) {
    logAcademicYearError("create academic year", context, error);

    if (isDuplicateAcademicYearNameError(error)) {
      redirectWithDuplicateNameError();
    }

    redirectWithSaveError();
  }

  if (shouldSetActive) {
    const { error: activeError } = await supabase.rpc(
      "set_active_academic_year",
      {
        target_academic_year_id: academicYear.id,
      },
    );

    if (activeError) {
      logAcademicYearError(
        "set active academic year after create",
        context,
        activeError,
      );
      redirectWithError("Academic year was created but could not be set active.");
    }
  }

  revalidatePath(ACADEMIC_YEARS_PATH);
  revalidatePath("/dashboard");
  redirect(ACADEMIC_YEARS_PATH);
}

export async function updateAcademicYear(formData: FormData) {
  const context = await requireAcademicYearOwnerPermission(
    "academic_years.update",
  );
  const { institute, supabase } = context;
  const academicYearId = getRequiredText(
    formData,
    "academicYearId",
    "Academic year",
  );
  const name = getRequiredText(formData, "name", "Academic year name");
  const startDate = getRequiredDate(formData, "startDate", "Start date");
  const endDate = getRequiredDate(formData, "endDate", "End date");

  validateDateRange(startDate, endDate);
  await ensureAcademicYearNameIsUnique(context, name, academicYearId);

  const { data: academicYear, error } = await supabase
    .from("academic_years")
    .update({
      end_date: endDate,
      name,
      start_date: startDate,
    })
    .eq("id", academicYearId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logAcademicYearError("update academic year", context, error);

    if (isDuplicateAcademicYearNameError(error)) {
      redirectWithDuplicateNameError();
    }

    redirectWithSaveError();
  }

  if (!academicYear) {
    redirectWithError("Select an academic year from this institute.");
  }

  revalidatePath(ACADEMIC_YEARS_PATH);
  revalidatePath("/dashboard");
  redirect(ACADEMIC_YEARS_PATH);
}

export async function setActiveAcademicYear(formData: FormData) {
  const context = await requireAcademicYearOwnerPermission(
    "academic_years.update",
  );
  const { supabase } = context;
  const academicYearId = getRequiredText(
    formData,
    "academicYearId",
    "Academic year",
  );

  const { error } = await supabase.rpc("set_active_academic_year", {
    target_academic_year_id: academicYearId,
  });

  if (error) {
    logAcademicYearError("set active academic year", context, error);
    redirectWithError("Could not set the active academic year.");
  }

  revalidatePath(ACADEMIC_YEARS_PATH);
  revalidatePath("/dashboard");
  redirect(ACADEMIC_YEARS_PATH);
}

export async function deleteAcademicYear(formData: FormData) {
  const context = await requireAcademicYearOwnerPermission(
    "academic_years.delete",
  );
  const { institute, supabase } = context;
  const academicYearId = getRequiredText(
    formData,
    "academicYearId",
    "Academic year",
  );

  const { count: linkedAttendanceCount, error: linkedAttendanceError } =
    await supabase
      .from("attendance_sessions")
      .select("id", { count: "exact", head: true })
      .eq("institute_id", institute.id)
      .eq("academic_year_id", academicYearId);

  if (linkedAttendanceError) {
    logAcademicYearError(
      "check academic year attendance links before delete",
      context,
      linkedAttendanceError,
    );
    redirectWithDeleteError();
  }

  if ((linkedAttendanceCount ?? 0) > 0) {
    redirectWithLinkedAttendanceError();
  }

  const { data: academicYear, error } = await supabase
    .from("academic_years")
    .delete()
    .eq("id", academicYearId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logAcademicYearError("delete academic year", context, error);

    if (isLinkedAttendanceDeleteError(error)) {
      redirectWithLinkedAttendanceError();
    }

    redirectWithDeleteError();
  }

  if (!academicYear) {
    redirectWithError("Select an academic year from this institute.");
  }

  revalidatePath(ACADEMIC_YEARS_PATH);
  revalidatePath("/dashboard");
  redirect(ACADEMIC_YEARS_PATH);
}
