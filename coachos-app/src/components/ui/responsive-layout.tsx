import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PageContainer provides a consistent max-width, centers elements, 
 * and applies responsive horizontal padding.
 */
export function PageContainer({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl min-w-0 px-4 sm:px-6 lg:px-8",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * SectionContainer wraps content sections with consistent vertical spacing.
 */
export function SectionContainer({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("w-full min-w-0 space-y-6", className)}
      {...props}
    >
      {children}
    </section>
  );
}

/**
 * ResponsiveGrid renders a CSS grid that defaults to a single-column layout on mobile 
 * and responsive columns on larger viewports with standard gap sizes.
 */
export function ResponsiveGrid({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * ResponsiveCardActions wraps action items (like buttons, badges, etc.) inside cards, 
 * allowing them to flex and wrap cleanly without causing horizontal scroll issues.
 */
export function ResponsiveCardActions({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 flex-wrap items-center gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
