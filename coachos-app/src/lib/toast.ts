"use client";

import { toast } from "sonner";

export function successToast(message: string) {
  toast.success(message);
}

export function errorToast(message: string) {
  toast.error(message);
}

export function infoToast(message: string) {
  toast.info(message);
}
