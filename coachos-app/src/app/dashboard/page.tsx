import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

const navItems = [
  "Overview",
  "Students",
  "Batches",
  "Attendance",
  "Fees",
  "Settings",
];

const metrics = [
  {
    label: "Total Students",
    value: "0",
    helper: "Student management coming soon",
  },
  {
    label: "Active Batches",
    value: "0",
    helper: "Batch setup coming soon",
  },
  {
    label: "Pending Fees",
    value: "Rs 0",
    helper: "Fee tracking coming soon",
  },
  {
    label: "Attendance Today",
    value: "0%",
    helper: "Attendance tools coming soon",
  },
];

function Sidebar() {
  return (
    <aside className="border-b border-border bg-card px-4 py-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:px-5">
      <div className="mb-5">
        <p className="text-lg font-semibold tracking-tight">CoachOS</p>
        <p className="mt-1 text-xs text-muted-foreground">Institute workspace</p>
      </div>
      <nav className="flex gap-2 overflow-x-auto md:grid md:overflow-visible">
        {navItems.map((item) => {
          const isActive = item === "Overview";

          return (
            isActive ? (
              <a
                key={item}
                href="/dashboard"
                aria-current="page"
                className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
              >
                {item}
              </a>
            ) : (
              <span
                key={item}
                aria-disabled="true"
                className="shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground"
              >
                {item}
              </span>
            )
          );
        })}
      </nav>
    </aside>
  );
}

function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </article>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, institute_id")
    .eq("id", claims.sub)
    .maybeSingle();

  if (!profile?.institute_id) {
    redirect("/onboarding");
  }

  const { data: institute } = await supabase
    .from("institutes")
    .select("name")
    .eq("id", profile.institute_id)
    .maybeSingle();

  return (
    <main className="min-h-full bg-background text-foreground">
      <div className="flex min-h-full flex-col md:flex-row">
        <Sidebar />

        <section className="flex-1 px-6 py-8 md:px-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {institute?.name ?? "Your institute"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Overview
                </h1>
                <p className="mt-2 text-muted-foreground">
                  Signed in as {claims.email ?? "your account"}.
                </p>
              </div>
              <form action={logout}>
                <Button type="submit" variant="outline">
                  Log out
                </Button>
              </form>
            </header>

            <section>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  Dashboard snapshot
                </h2>
                <p className="text-sm text-muted-foreground">
                  Static placeholders for the first dashboard shell. Live
                  student, batch, attendance, and fee data will be added later.
                </p>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metrics.map((metric) => (
                  <MetricCard
                    key={metric.label}
                    label={metric.label}
                    value={metric.value}
                    helper={metric.helper}
                  />
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
