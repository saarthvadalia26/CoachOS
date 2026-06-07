"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canAccessPermission,
  getDefaultBranchId,
  requireDashboardAccess,
  type DashboardContext,
  type Permission,
  staffRoles,
  type StaffRole,
} from "@/lib/auth/permissions";
import { needsExplicitBranchSelection } from "@/lib/dashboard/branch-scope";

const STAFF_PATH = "/dashboard/staff";

function redirectWithError(message: string): never {
  redirect(`${STAFF_PATH}?error=${encodeURIComponent(message)}`);
}

function getRequiredText(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirectWithError(`${label} is required.`);
  }

  return value;
}

function getOptionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value || null;
}

function getStaffRole(formData: FormData) {
  const role = String(formData.get("role") ?? "teacher").trim();

  if (staffRoles.includes(role as StaffRole)) {
    return role as StaffRole;
  }

  redirectWithError("Select a valid non-owner staff role.");
}

function getStaffMemberId(formData: FormData) {
  return getRequiredText(formData, "staffMemberId", "Staff member");
}

function getStaffBranchId(
  formData: FormData,
  context: DashboardContext,
) {
  const branchId = getOptionalId(formData, "branchId");

  if (!branchId && needsExplicitBranchSelection(context)) {
    redirectWithError("Select a branch for this staff member.");
  }

  return branchId ?? getDefaultBranchId(context);
}

function requireStaffPermission(
  context: DashboardContext,
  permission: Permission,
  branchId: string | null,
) {
  if (
    !canAccessPermission(context, permission, {
      branchId,
      instituteId: context.institute.id,
    })
  ) {
    redirectWithError("You do not have permission to perform this action.");
  }
}

export async function createStaffMember(formData: FormData) {
  const context = await requireDashboardAccess();
  const { institute, supabase } = context;

  const fullName = getRequiredText(formData, "fullName", "Full name");
  const email = getRequiredText(formData, "email", "Email").toLowerCase();
  const role = getStaffRole(formData);
  const branchId = getStaffBranchId(formData, context);

  requireStaffPermission(context, "staff.create", branchId);

  const { error } = await supabase.from("staff_members").insert({
    branch_id: branchId,
    email,
    full_name: fullName,
    institute_id: institute.id,
    role,
  });

  if (error) {
    console.error("createStaffMember failed", error);
    redirectWithError(
      "This staff member record could not be saved. Please review the details and try again.",
    );
  }

  revalidatePath(STAFF_PATH);
  redirect(branchId ? `${STAFF_PATH}?branchId=${encodeURIComponent(branchId)}` : STAFF_PATH);
}

export async function updateStaffMember(formData: FormData) {
  const context = await requireDashboardAccess();
  const { institute, supabase } = context;

  const staffMemberId = getStaffMemberId(formData);
  const fullName = getRequiredText(formData, "fullName", "Full name");
  const email = getRequiredText(formData, "email", "Email").toLowerCase();
  const role = getStaffRole(formData);
  const branchId = getStaffBranchId(formData, context);

  const { data: existingStaffMember, error: existingStaffMemberError } =
    await supabase
      .from("staff_members")
      .select("id, branch_id")
      .eq("id", staffMemberId)
      .eq("institute_id", institute.id)
      .maybeSingle();

  if (existingStaffMemberError) {
    console.error("updateStaffMember lookup failed", existingStaffMemberError);
    redirectWithError("This staff member record could not be updated. Please try again.");
  }

  if (!existingStaffMember) {
    redirectWithError("Select a staff member from this institute.");
  }

  requireStaffPermission(context, "staff.update", existingStaffMember.branch_id);
  requireStaffPermission(context, "staff.update", branchId);

  const { data: updatedStaffMember, error } = await supabase
    .from("staff_members")
    .update({
      branch_id: branchId,
      email,
      full_name: fullName,
      role,
    })
    .eq("id", staffMemberId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateStaffMember failed", error);
    redirectWithError("This staff member record could not be updated. Please try again.");
  }

  if (!updatedStaffMember) {
    redirectWithError("Select a staff member from this institute.");
  }

  revalidatePath(STAFF_PATH);
  redirect(
    branchId ? `${STAFF_PATH}?branchId=${encodeURIComponent(branchId)}` : STAFF_PATH,
  );
}

export async function deleteStaffMember(formData: FormData) {
  const context = await requireDashboardAccess();
  const { institute, supabase } = context;

  const staffMemberId = getStaffMemberId(formData);

  const { data: existingStaffMember, error: existingStaffMemberError } =
    await supabase
      .from("staff_members")
      .select("id, branch_id")
      .eq("id", staffMemberId)
      .eq("institute_id", institute.id)
      .maybeSingle();

  if (existingStaffMemberError) {
    console.error("deleteStaffMember lookup failed", existingStaffMemberError);
    redirectWithError("This staff member record could not be deleted. Please try again.");
  }

  if (!existingStaffMember) {
    redirectWithError("Select a staff member from this institute.");
  }

  requireStaffPermission(context, "staff.delete", existingStaffMember.branch_id);

  const { data: deletedStaffMember, error } = await supabase
    .from("staff_members")
    .delete()
    .eq("id", staffMemberId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteStaffMember failed", error);
    redirectWithError("This staff member record could not be deleted. Please try again.");
  }

  if (!deletedStaffMember) {
    redirectWithError("Select a staff member from this institute.");
  }

  revalidatePath(STAFF_PATH);
  redirect(
    existingStaffMember.branch_id
      ? `${STAFF_PATH}?branchId=${encodeURIComponent(existingStaffMember.branch_id)}`
      : STAFF_PATH,
  );
}
