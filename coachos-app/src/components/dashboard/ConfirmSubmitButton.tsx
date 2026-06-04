"use client";

import type { ComponentProps, MouseEvent } from "react";

import { Button } from "@/components/ui/button";

type ConfirmSubmitButtonProps = ComponentProps<typeof Button> & {
  confirmMessage: string;
};

export function ConfirmSubmitButton({
  confirmMessage,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) {
  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return <Button {...props} onClick={handleClick} />;
}
