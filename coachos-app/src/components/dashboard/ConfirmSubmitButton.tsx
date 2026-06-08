"use client";

import type { ComponentProps, MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = ComponentProps<typeof Button> & {
  confirmMessage: string;
  pendingLabel?: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  disabled,
  onClick,
  pendingLabel = "Deleting...",
  ...props
}: ConfirmSubmitButtonProps) {
  const { pending } = useFormStatus();

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <Button
      {...props}
      aria-busy={pending}
      disabled={disabled || pending}
      onClick={handleClick}
    >
      {pending ? (
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
}
