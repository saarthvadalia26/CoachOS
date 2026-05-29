"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    redirect(
      `/onboarding?error=${encodeURIComponent(instituteError?.message ?? "Could not create institute.")}`,
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
    redirect(`/onboarding?error=${encodeURIComponent(profileError.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}
