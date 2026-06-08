"use client";

import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExportButtonProps = Omit<ComponentProps<typeof Button>, "asChild"> & {
  disabledReason?: string;
  href: string;
  idleLabel?: string;
  pendingLabel?: string;
};

export function ExportButton({
  disabled,
  disabledReason = "No records match the selected filters.",
  href,
  idleLabel = "Export CSV",
  pendingLabel = "Exporting...",
  ...props
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const isDisabled = disabled || isExporting;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  function handleExport() {
    if (isDisabled) {
      return;
    }

    setIsExporting(true);
    window.location.assign(href);

    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setIsExporting(false);
      resetTimerRef.current = null;
    }, 4000);
  }

  return (
    <div className="grid gap-1">
      <Button
        {...props}
        aria-busy={isExporting}
        disabled={isDisabled}
        onClick={handleExport}
        type="button"
      >
        {isExporting ? (
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin"
            data-icon="inline-start"
          />
        ) : (
          <Download aria-hidden="true" data-icon="inline-start" />
        )}
        {isExporting ? pendingLabel : idleLabel}
      </Button>
      {disabled && !isExporting ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
