const productLinks = [
  { href: "#value", label: "Why CoachOS" },
  { href: "#features", label: "Features" },
  { href: "#contact", label: "Book a demo" },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="text-lg font-semibold tracking-tight">CoachOS</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
            A secure operating dashboard for coaching institutes managing
            branches, students, batches, attendance, fees, and staff.
          </p>
        </div>

        <div>
          <h2 className="text-sm font-medium">Product</h2>
          <nav className="mt-3 grid gap-2 text-sm text-muted-foreground">
            {productLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-medium">Contact</h2>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <a
              href="mailto:hello@coachos.app"
              className="transition-colors hover:text-foreground"
            >
              hello@coachos.app
            </a>
            <p>Demo scheduling available on request.</p>
          </div>
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
