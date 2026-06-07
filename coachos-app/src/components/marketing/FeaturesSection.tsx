import { FeatureCard } from "@/components/marketing/FeatureCard";

const features = [
  {
    title: "Batch & Student Management",
    description:
      "Organize students, batches, schedules, and attendance in one operations dashboard built for busy coaching teams.",
  },
  {
    title: "Fees & Payment Tracking",
    description:
      "Track dues, paid fees, reminders, and collections without juggling spreadsheets or handwritten registers.",
  },
  {
    title: "Attendance & Audit History",
    description:
      "Submit daily attendance, reopen records with approval, and review a clear audit history for corrections.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Core features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Designed around the daily rhythm of coaching institutes.
        </h2>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
          />
        ))}
      </div>
    </section>
  );
}
