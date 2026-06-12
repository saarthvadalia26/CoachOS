"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      closeButton
      expand={false}
      richColors
      position="top-right"
      toastOptions={{
        className: "font-sans",
        duration: 4200,
      }}
    />
  );
}
