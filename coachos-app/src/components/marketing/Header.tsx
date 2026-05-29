import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <a href="#" className="text-lg font-semibold tracking-tight">
          CoachOS
        </a>
        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#value" className="transition-colors hover:text-foreground">
            Why CoachOS
          </a>
          <a
            href="#features"
            className="transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a href="#contact" className="transition-colors hover:text-foreground">
            Demo
          </a>
        </nav>
        <Button asChild size="sm">
          <a href="#contact">Book a demo</a>
        </Button>
      </div>
    </header>
  );
}
