"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { logActivity } from "@/lib/activity/log";
import { requirePermission } from "@/lib/auth/permissions";

const BRANCHES_PATH = "/dashboard/branches";

function redirectWithError(message: string): never {
  redirect(`${BRANCHES_PATH}?error=${encodeURIComponent(message)}`);
}

function redirectWithSuccess(message: string): never {
  redirect(`${BRANCHES_PATH}?success=${encodeURIComponent(message)}`);
}

function redirectWithSaveError(): never {
  redirectWithError(
    "This branch record could not be saved. Please review the details and try again.",
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

export async function createBranch(formData: FormData) {
  const context = await requirePermission("branches.create");
  const { institute, supabase } = context;

  const name = getRequiredText(formData, "name", "Branch name");
  const address = getOptionalText(formData, "address");

  const { data: branch, error } = await supabase
    .from("branches")
    .insert({
      address,
      institute_id: institute.id,
      name,
    })
    .select("id")
    .maybeSingle();

  if (error || !branch) {
    console.error("createBranch failed", error);
    redirectWithSaveError();
  }

  await logActivity(context, {
    action: "branch.created",
    branchId: branch.id,
    description: "Branch record created.",
    entityId: branch.id,
    entityLabel: name,
    entityType: "branch",
  });

  revalidatePath(BRANCHES_PATH);
  revalidatePath("/dashboard");
  redirectWithSuccess("Branch created.");
}

export async function updateBranch(formData: FormData) {
  const branchId = getRequiredText(formData, "branchId", "Branch");
  const name = getRequiredText(formData, "name", "Branch name");
  const address = getOptionalText(formData, "address");
  const context = await requirePermission("branches.update", {
    branchId,
  });
  const { institute, supabase } = context;

  const { data: updatedBranch, error } = await supabase
    .from("branches")
    .update({
      address,
      name,
    })
    .eq("id", branchId)
    .eq("institute_id", institute.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateBranch failed", error);
    redirectWithSaveError();
  }

  if (!updatedBranch) {
    redirectWithError("Select a branch from this institute.");
  }

  await logActivity(context, {
    action: "branch.updated",
    branchId,
    description: "Branch details updated.",
    entityId: branchId,
    entityLabel: name,
    entityType: "branch",
  });

  revalidatePath(BRANCHES_PATH);
  revalidatePath("/dashboard");
  redirectWithSuccess("Branch updated.");
}
