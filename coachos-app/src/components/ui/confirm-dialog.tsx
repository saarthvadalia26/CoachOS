"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { AlertDialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConfirmDialogProps = {
  cancelLabel?: string;
  confirmLabel: string;
  description: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  pending?: boolean;
  pendingLabel?: string;
  title: string;
  trigger: ReactNode;
};

export function ConfirmDialog({
  cancelLabel = "Cancel",
  confirmLabel,
  description,
  destructive = false,
  onConfirm,
  pending = false,
  pendingLabel = "Working...",
  title,
  trigger,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [internalPending, setInternalPending] = useState(false);
  const isPending = pending || internalPending;

  async function handleConfirm() {
    if (isPending) {
      return;
    }

    setInternalPending(true);

    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setInternalPending(false);
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          setOpen(nextOpen);
        }
      }}
    >
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <AlertDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-5 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-2xl shadow-primary/20 outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <div className="grid gap-2">
            <AlertDialog.Title className="text-lg font-semibold tracking-tight">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialog.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button
                disabled={isPending}
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
              >
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              aria-busy={isPending}
              className="w-full sm:w-auto"
              disabled={isPending}
              onClick={() => void handleConfirm()}
              type="button"
              variant={destructive ? "destructive" : "default"}
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
                confirmLabel
              )}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
