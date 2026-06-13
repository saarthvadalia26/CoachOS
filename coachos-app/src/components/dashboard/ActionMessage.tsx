import { cn } from "@/lib/utils";

type ActionMessageProps = {
  className?: string;
  error?: string | null;
  success?: string | null;
};

export function ActionMessage({
  className,
  error,
  success,
}: ActionMessageProps) {
  if (!error && !success) {
    return null;
  }

  return (
    <p
      className={cn(
        error
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200",
        className,
      )}
    >
      {error ?? success}
    </p>
  );
}
