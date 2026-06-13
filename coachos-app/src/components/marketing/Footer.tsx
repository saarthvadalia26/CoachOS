import Link from "next/link";

const productLinks = [
  { href: "/#value", label: "Why CoachOS" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Book a demo" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/70">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-lg bg-[#1e1b4b] text-white shadow-sm">
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
            CoachOS
          </Link>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            A secure operating dashboard for coaching institutes managing
            branches, students, batches, attendance, fees, and staff.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium">Product</h2>
          <nav className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-medium">Company</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/contact" className="transition-colors hover:text-foreground">
              Contact CoachOS
            </Link>
            <p>Demo scheduling available on request.</p>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium">Legal</h2>
          <nav className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms of service
            </Link>
            <Link href="/security" className="transition-colors hover:text-foreground">
              Security
            </Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-border px-6 py-4">
        <p className="mx-auto max-w-6xl text-xs text-muted-foreground">
          Copyright {year} CoachOS. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
