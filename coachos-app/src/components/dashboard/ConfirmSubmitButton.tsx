"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ConfirmSubmitButtonProps = ComponentProps<typeof Button> & {
  cancelLabel?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  confirmMessage: string;
  confirmTitle?: string;
  destructive?: boolean;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  cancelLabel = "Cancel",
  children,
  confirmDescription,
  confirmLabel,
  confirmMessage,
  confirmTitle = "Confirm action",
  destructive,
  disabled,
  onClick,
  pendingLabel = "Deleting...",
  variant,
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPending = pending || isSubmitting;
  const isDestructive = destructive ?? variant === "destructive";

  function handleTriggerClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);
  }

  function submitParentForm() {
    const form = triggerRef.current?.form;

    if (!form) {
      return;
    }

    setIsSubmitting(true);
    form.requestSubmit();
  }

  const trigger = (
    <Button
      {...props}
      aria-busy={isPending}
      disabled={disabled || isPending}
      onClick={handleTriggerClick}
      ref={triggerRef}
      type="button"
      variant={variant}
    >
      {isPending ? (
        <>
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin"
            data-icon="inline-start"
          />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );

  return (
    <ConfirmDialog
      cancelLabel={cancelLabel}
      confirmLabel={
        confirmLabel ?? (isDestructive ? "Confirm delete" : "Confirm")
      }
      description={confirmDescription ?? confirmMessage}
      destructive={isDestructive}
      onConfirm={submitParentForm}
      pending={isPending}
      pendingLabel={pendingLabel}
      title={confirmTitle}
      trigger={trigger}
    />
  );
}
