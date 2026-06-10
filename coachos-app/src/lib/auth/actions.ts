"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { passwordRecoveryCookieName } from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/server";

function getAuthData(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
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

async function getAppOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (origin) {
    return origin;
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");

  if (host) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto");
    const protocol =
      forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

    return `${protocol}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

function getAuthRedirectUrl(origin: string, nextPath?: string) {
  const redirectUrl = new URL("/auth/confirm", origin);

  if (nextPath) {
    redirectUrl.searchParams.set("next", nextPath);
  }

  return redirectUrl.toString();
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
  const origin = await getAppOrigin();
  const authData = getAuthData(formData);

  if (authData.password.length < 8) {
    redirect(
      `/signup?error=${encodeURIComponent("Use a password with at least 8 characters.")}`,
    );
  }

  const { data, error } = await supabase.auth.signUp({
    ...authData,
    options: {
      emailRedirectTo: getAuthRedirectUrl(origin),
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

export async function requestPasswordReset(formData: FormData) {
  const supabase = await createClient();
  const origin = await getAppOrigin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Enter the email address for your CoachOS account.")}`,
    );
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(origin, "/reset-password"),
  });

  if (error) {
    console.error("password reset request failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    redirect(
      `/forgot-password?error=${encodeURIComponent("Password reset instructions could not be sent. Please check the email address and try again.")}`,
    );
  }

  redirect(
    `/forgot-password?message=${encodeURIComponent("If a CoachOS account exists for this email, password reset instructions have been sent.")}`,
  );
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const hasRecoveryMarker =
    cookieStore.get(passwordRecoveryCookieName)?.value === "1";

  if (!hasRecoveryMarker) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Your password reset link has expired. Request a new reset email to continue.")}`,
    );
  }

  if (password.length < 8) {
    redirect(
      `/reset-password?error=${encodeURIComponent("Your new password must be at least 8 characters.")}`,
    );
  }

  if (password !== confirmPassword) {
    redirect(
      `/reset-password?error=${encodeURIComponent("The password confirmation does not match.")}`,
    );
  }

  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Your password reset link has expired. Request a new reset email to continue.")}`,
    );
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("password update failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    redirect(
      `/reset-password?error=${encodeURIComponent("Your password could not be updated. Please request a new reset email and try again.")}`,
    );
  }

  await supabase.auth.signOut();
  cookieStore.delete(passwordRecoveryCookieName);

  revalidatePath("/", "layout");
  redirect(
    `/login?message=${encodeURIComponent("Your password has been updated. Please log in.")}`,
  );
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/login");
}
