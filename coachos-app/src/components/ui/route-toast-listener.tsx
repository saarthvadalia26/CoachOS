"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { errorToast, infoToast, successToast } from "@/lib/toast";

const toastParamKeys = ["error", "message", "success"] as const;

function getFriendlyError(pathname: string, message: string) {
  if (pathname === "/login") {
    return "We could not sign you in. Please check your email and password.";
  }

  if (pathname === "/reset-password") {
    return "We could not update your password. Please try again.";
  }

  if (pathname === "/forgot-password") {
    return "Password reset instructions could not be sent. Please try again.";
  }

  return message || "This action could not be completed. Please try again.";
}

function getFriendlyMessage(pathname: string, message: string) {
  if (pathname === "/forgot-password") {
    return "Password reset email sent.";
  }

  if (pathname === "/login" && message.toLowerCase().includes("password")) {
    return "Your password has been updated.";
  }

  if (pathname === "/login" && message.toLowerCase().includes("confirm")) {
    return "Check your email to confirm your account.";
  }

  return message;
}

function getNextUrl(pathname: string, searchParams: { toString(): string }) {
  const nextParams = new URLSearchParams(searchParams.toString());

  for (const key of toastParamKeys) {
    nextParams.delete(key);
  }

  const queryString = nextParams.toString();

  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function RouteToastListener() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    const message = searchParams.get("message");
    const error = searchParams.get("error");

    if (!success && !message && !error) {
      return;
    }

    const toastKey = `${pathname}?${searchParams.toString()}`;

    if (toastKey === lastToastKeyRef.current) {
      return;
    }

    lastToastKeyRef.current = toastKey;

    if (error) {
      errorToast(getFriendlyError(pathname, error));
    } else if (success) {
      successToast(success);
    } else if (message) {
      infoToast(getFriendlyMessage(pathname, message));
    }

    router.replace(getNextUrl(pathname, searchParams), { scroll: false });
  }, [pathname, router, searchParams]);

  return null;
}
