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

  if (error) {
    return (
      <p
        className={cn(
          "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
          className,
        )}
      >
        {error}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300",
        className,
      )}
    >
      {success}
    </p>
  );
}
