"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requirePermission } from "@/lib/auth/permissions";

const BRANCHES_PATH = "/dashboard/branches";

function redirectWithError(message: string): never {
  redirect(`${BRANCHES_PATH}?error=${encodeURIComponent(message)}`);
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
  const { institute, supabase } = await requirePermission("branches.create");

  const name = getRequiredText(formData, "name", "Branch name");
  const address = getOptionalText(formData, "address");

  const { error } = await supabase.from("branches").insert({
    address,
    institute_id: institute.id,
    name,
  });

  if (error) {
    console.error("createBranch failed", error);
    redirectWithSaveError();
  }

  revalidatePath(BRANCHES_PATH);
  revalidatePath("/dashboard");
  redirect(BRANCHES_PATH);
}

export async function updateBranch(formData: FormData) {
  const branchId = getRequiredText(formData, "branchId", "Branch");
  const name = getRequiredText(formData, "name", "Branch name");
  const address = getOptionalText(formData, "address");
  const { institute, supabase } = await requirePermission("branches.update", {
    branchId,
  });

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

  revalidatePath(BRANCHES_PATH);
  revalidatePath("/dashboard");
  redirect(BRANCHES_PATH);
}
