import { cn } from "@/lib/utils";

type ActionMessageProps = {
  className?: string;
  error?: string | null;
};

export function ActionMessage({
  className,
  error,
}: ActionMessageProps) {
  if (!error) {
    return null;
  }

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
