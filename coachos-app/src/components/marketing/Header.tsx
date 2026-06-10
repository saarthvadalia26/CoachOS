import { LogIn, Menu } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/#value", label: "Why CoachOS" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              C
            </span>
            CoachOS
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">
                <LogIn aria-hidden="true" data-icon="inline-start" />
                Log in
              </Link>
            </Button>
            <Button asChild size="sm" variant="accent">
              <Link href="/contact">Book a demo</Link>
            </Button>
          </div>

          <details className="group md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden="true" className="size-4" />
              <span className="sr-only">Open navigation</span>
            </summary>
            <div className="absolute left-6 right-6 z-20 mt-3 rounded-lg border border-border bg-background p-3 shadow-lg shadow-primary/10">
              <nav className="grid gap-1 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="accent">
                  <Link href="/contact">Book a demo</Link>
                </Button>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
