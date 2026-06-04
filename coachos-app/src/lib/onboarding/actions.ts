"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  claimStaffProfileForCurrentUser,
  getStaffLinkStatusMessage,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

function getRequiredText(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    redirect(
      `/onboarding?error=${encodeURIComponent("Please fill in all required fields.")}`,
    );
  }

  return value;
}

export async function createInstituteAndProfile(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (error || !userId) {
    redirect("/login");
  }

  // Staff linking guard:
  // A teacher/staff account that matches staff_members must be linked to that
  // institute instead of creating a new institute through owner onboarding.
  const linkedStaff = await claimStaffProfileForCurrentUser();

  if (linkedStaff.profile?.institute_id) {
    redirect("/dashboard");
  }

  const staffLinkMessage = getStaffLinkStatusMessage(linkedStaff.status);

  if (staffLinkMessage) {
    redirect(`/onboarding?error=${encodeURIComponent(staffLinkMessage)}`);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("institute_id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile?.institute_id) {
    redirect("/dashboard");
  }

  const instituteName = getRequiredText(formData, "instituteName");
  const fullName = getRequiredText(formData, "fullName");

  const { data: institute, error: instituteError } = await supabase
    .from("institutes")
    .insert({
      name: instituteName,
      owner_id: userId,
    })
    .select("id")
    .single();

  if (instituteError || !institute) {
    console.error("createInstituteAndProfile institute insert failed", instituteError);
    redirect(
      `/onboarding?error=${encodeURIComponent("Could not create the institute. Please try again.")}`,
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      institute_id: institute.id,
      full_name: fullName,
      role: "owner",
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    console.error("createInstituteAndProfile profile upsert failed", profileError);
    redirect(
      `/onboarding?error=${encodeURIComponent("Could not finish setup. Please try again.")}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
