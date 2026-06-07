"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getAuthData(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

function getNextPath(formData: FormData) {
  const next = formData.get("next");

  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/dashboard";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const authData = getAuthData(formData);

  const { error } = await supabase.auth.signInWithPassword(authData);

  if (error) {
    console.error("login failed", error);
    redirect(
      `/login?error=${encodeURIComponent("Invalid email or password.")}`,
    );
  }

  revalidatePath("/", "layout");
  redirect(getNextPath(formData));
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const authData = getAuthData(formData);

  const { data, error } = await supabase.auth.signUp({
    ...authData,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    console.error("signup failed", error);
    redirect(
      `/signup?error=${encodeURIComponent("This account could not be created. Please check your email and password and try again.")}`,
    );
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    "/login?message=Check%20your%20email%20to%20confirm%20your%20account%2C%20then%20sign%20in.",
  );
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
