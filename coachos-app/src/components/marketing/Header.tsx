import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "#value", label: "Why CoachOS" },
  { href: "#features", label: "Features" },
  { href: "#contact", label: "Demo" },
];

export function Header() {
  return (
    <header className="relative border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <a href="#" className="text-lg font-semibold tracking-tight">
            CoachOS
          </a>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden md:block">
            <Button asChild size="sm">
              <a href="#contact">Book a demo</a>
            </Button>
          </div>

          <details className="group md:hidden">
            <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              <Menu aria-hidden="true" className="size-4" />
              <span className="sr-only">Open navigation</span>
            </summary>
            <div className="absolute left-6 right-6 z-20 mt-3 rounded-md border border-border bg-background p-3 shadow-sm">
              <nav className="grid gap-1 text-sm">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
                <Button asChild className="mt-2">
                  <a href="#contact">Book a demo</a>
                </Button>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
