"use client";

import { LogIn, Menu, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const navLinks = [
  { href: "/#value", label: "Why CoachOS" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileMenuId = useId();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <svg
                className="size-4"
                viewBox="0 0 28 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4L12 12L4 20" />
                <path d="M15 4L23 12L15 20" />
              </svg>
            </span>
            <span className="truncate">CoachOS</span>
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
            <ThemeToggle />
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

          <div className="relative shrink-0 md:hidden">
            <button
              type="button"
              aria-controls={mobileMenuId}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((current) => !current)}
              className="flex size-10 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              {isMenuOpen ? (
                <X aria-hidden="true" className="size-4" />
              ) : (
                <Menu aria-hidden="true" className="size-4" />
              )}
              <span className="sr-only">
                {isMenuOpen ? "Close navigation" : "Open navigation"}
              </span>
            </button>
            <div
              id={mobileMenuId}
              className={
                isMenuOpen
                  ? "absolute right-0 z-20 mt-3 w-[min(calc(100vw-2rem),20rem)] max-w-[calc(100vw-2rem)] translate-y-0 overflow-hidden rounded-lg border border-border bg-background p-3 opacity-100 shadow-lg shadow-primary/10 transition-all duration-200 ease-out"
                  : "pointer-events-none absolute right-0 z-20 mt-3 w-[min(calc(100vw-2rem),20rem)] max-w-[calc(100vw-2rem)] -translate-y-2 overflow-hidden rounded-lg border border-transparent bg-background p-0 opacity-0 shadow-lg shadow-primary/10 transition-all duration-200 ease-out"
              }
            >
              <nav className="grid gap-1 text-sm" aria-label="Mobile navigation">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground">Theme</span>
                  <ThemeToggle />
                </div>
                <Button asChild variant="outline" className="mt-1">
                  <Link href="/login" onClick={() => setIsMenuOpen(false)}>
                    Log in
                  </Link>
                </Button>
                <Button asChild variant="accent">
                  <Link href="/contact" onClick={() => setIsMenuOpen(false)}>
                    Book a demo
                  </Link>
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
