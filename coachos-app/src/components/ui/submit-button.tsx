"use client";

import type { ComponentProps, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type SubmitButtonProps = ComponentProps<typeof Button> & {
  pendingLabel?: string;
  pendingIcon?: ReactNode;
};

export function SubmitButton({
  children,
  disabled,
  pendingIcon,
  pendingLabel = "Saving...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      {...props}
      disabled={disabled || pending}
      aria-busy={pending}
      type={props.type ?? "submit"}
    >
      {pending ? (
        <>
          {pendingIcon ?? (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin"
              data-icon="inline-start"
            />
          )}
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
