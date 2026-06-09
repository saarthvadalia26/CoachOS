import {
  Building2,
  CalendarCheck,
  GraduationCap,
  Receipt,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { FeatureCard } from "@/components/marketing/FeatureCard";

const features = [
  {
    title: "Branch Management",
    description:
      "Organize physical centers, branch managers, students, staff, and operational activity under one institute account.",
    icon: Building2,
  },
  {
    title: "Student Management",
    description:
      "Maintain professional student records with branch, contact, batch, attendance, and fee context in one profile.",
    icon: UsersRound,
  },
  {
    title: "Batch Management",
    description:
      "Create batches by branch, assign students, assign teachers, and keep schedules visible to the right team members.",
    icon: GraduationCap,
  },
  {
    title: "Attendance Tracking",
    description:
      "Submit locked attendance, reopen corrections with audit history, and review attendance across dates and batches.",
    icon: CalendarCheck,
  },
  {
    title: "Fee Management",
    description:
      "Track dues, payments, pending balances, overdue records, and CSV exports without spreadsheet drift.",
    icon: Receipt,
  },
  {
    title: "Staff Roles & Permissions",
    description:
      "Give owners, branch managers, accountants, operations staff, coordinators, and teachers role-aware access.",
    icon: ShieldCheck,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto w-full max-w-6xl px-6 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary">
          Core features
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">
          Designed around the daily rhythm of coaching institutes.
        </h2>
        <p className="mt-4 text-muted-foreground">
          CoachOS focuses on operational clarity first: branches, students,
          batches, attendance, fees, and staff access in one clean workflow.
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
          />
        ))}
      </div>
    </section>
  );
}
