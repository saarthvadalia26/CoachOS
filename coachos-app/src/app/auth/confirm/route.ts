import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import {
  isPasswordRecoveryNextPath,
  passwordRecoveryCookieName,
  passwordRecoveryCookieOptions,
} from "@/lib/auth/password-reset";
import { createClient } from "@/lib/supabase/server";

function getSafeNextPath(next: string | null) {
  if (next?.startsWith("/") && !next.startsWith("//")) {
    return next;
  }

  return "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const isRecovery = type === "recovery" || isPasswordRecoveryNextPath(next);
  const successPath = isRecovery ? "/reset-password" : next;
  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const response = NextResponse.redirect(new URL(successPath, request.url));

      if (isRecovery) {
        response.cookies.set(
          passwordRecoveryCookieName,
          "1",
          passwordRecoveryCookieOptions,
        );
      }

      return response;
    }

    console.error("auth confirmation code exchange failed", {
      code: error.code,
      flow: isRecovery ? "password_recovery" : "email_confirmation",
      message: error.message,
      next,
      status: error.status,
    });
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      const response = NextResponse.redirect(new URL(successPath, request.url));

      if (isRecovery) {
        response.cookies.set(
          passwordRecoveryCookieName,
          "1",
          passwordRecoveryCookieOptions,
        );
      }

      return response;
    }

    console.error("auth token verification failed", {
      code: error.code,
      flow: isRecovery ? "password_recovery" : "email_confirmation",
      message: error.message,
      next,
      status: error.status,
      type,
    });
  }

  const fallbackPath = isRecovery
    ? `/forgot-password?error=${encodeURIComponent("This password reset link is invalid or has expired. Request a new reset email to continue.")}`
    : `/login?error=${encodeURIComponent("Your email could not be confirmed. Please try again.")}`;

  return NextResponse.redirect(new URL(fallbackPath, request.url));
}
