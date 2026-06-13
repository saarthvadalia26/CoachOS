import { CalendarDays, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import type { Metadata } from "next";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createAcademicYear,
  deleteAcademicYear,
  setActiveAcademicYear,
  updateAcademicYear,
} from "@/lib/academic-years/actions";
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";
import { formatDateRange } from "@/lib/formatters/date";

export const metadata: Metadata = {
  title: "Academic Years",
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
};

function getSupabaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return {
      code: undefined,
      details: undefined,
      hint: undefined,
      message: undefined,
    };
  }

  const supabaseError = error as {
    code?: string;
    details?: string;
    hint?: string;
    message?: string;
  };

  return {
    code: supabaseError.code,
    details: supabaseError.details,
    hint: supabaseError.hint,
    message: supabaseError.message,
  };
}

export default async function AcademicYearsPage() {
  const context = await requirePermission("academic_years.view");
  const { claims, currentMembership, institute, profile, role, supabase } =
    context;
  const canManageAcademicYears =
    role === "owner" &&
    canAccessPermission(context, "academic_years.create", {
      instituteId: institute.id,
    }) &&
    canAccessPermission(context, "academic_years.update", {
      instituteId: institute.id,
    }) &&
    canAccessPermission(context, "academic_years.delete", {
      instituteId: institute.id,
    });

  const { data: academicYearRows, error } = await supabase
    .from("academic_years")
    .select("id, name, start_date, end_date, is_active")
    .eq("institute_id", institute.id)
    .order("start_date", { ascending: false });

  const academicYears = (academicYearRows ?? []) as AcademicYear[];

  if (error) {
    console.error("academic years page load failed", {
      institute_id: institute.id,
      membership_id: currentMembership.id,
      operation: "load academic years",
      role,
      supabase_error: getSupabaseErrorDetails(error),
      user_id: claims.sub,
    });
  }

  return (
    <DashboardShell
      activePage="settings"
      instituteName={institute.name}
      role={role}
      title="Academic Years"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section
        className={
          canManageAcademicYears
            ? "grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]"
            : "grid gap-6"
        }
      >
        {canManageAcademicYears ? (
          <Card id="create-academic-year">
            <CardHeader>
              <CardTitle className="text-xl">Create academic year</CardTitle>
              <CardDescription>
                Add an academic year for attendance grouping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createAcademicYear} className="grid gap-4">
                <Label>
                  Name
                  <Input
                    required
                    name="name"
                    type="text"
                    placeholder="2026-27"
                  />
                  <span className="text-xs font-normal text-muted-foreground">
                    Example: 2026-27
                  </span>
                </Label>
                <Label>
                  Start date
                  <Input required name="startDate" type="date" />
                  <span className="text-xs font-normal text-muted-foreground">
                    Example: Jun 1, 2026
                  </span>
                </Label>
                <Label>
                  End date
                  <Input required name="endDate" type="date" />
                  <span className="text-xs font-normal text-muted-foreground">
                    Example: May 31, 2027
                  </span>
                </Label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    name="isActive"
                    type="checkbox"
                    className="size-4 rounded border-border"
                  />
                  Set as active
                </label>
                <SubmitButton className="mt-1" pendingLabel="Creating...">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Create academic year
                </SubmitButton>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Academic year list
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {academicYears.length}{" "}
                {academicYears.length === 1
                  ? "academic year"
                  : "academic years"}{" "}
                in {institute.name}
              </p>
            </div>
            <Badge variant="outline">
              {canManageAcademicYears ? "Owner managed" : "Read only"}
            </Badge>
          </div>

          {error ? (
            <ActionMessage error="Academic years are unavailable right now. Please try again." />
          ) : null}

          {academicYears.length ? (
            <div className="grid gap-4">
              {academicYears.map((academicYear) => (
                <Card key={academicYear.id}>
                  <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarDays
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                        {academicYear.name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {formatDateRange(
                          academicYear.start_date,
                          academicYear.end_date,
                        )}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={academicYear.is_active ? "secondary" : "outline"}
                    >
                      {academicYear.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {canManageAcademicYears ? (
                      <>
                        <details className="rounded-md border border-border bg-muted/30 p-3">
                          <summary className="cursor-pointer text-sm font-medium">
                            Edit academic year
                          </summary>
                          <form
                            action={updateAcademicYear}
                            className="mt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <input
                              name="academicYearId"
                              type="hidden"
                              value={academicYear.id}
                            />
                            <Label>
                              Name
                              <Input
                                required
                                name="name"
                                type="text"
                                defaultValue={academicYear.name}
                              />
                              <span className="text-xs font-normal text-muted-foreground">
                                Example: 2026-27
                              </span>
                            </Label>
                            <Label>
                              Start date
                              <Input
                                required
                                name="startDate"
                                type="date"
                                defaultValue={academicYear.start_date}
                              />
                              <span className="text-xs font-normal text-muted-foreground">
                                Example: Jun 1, 2026
                              </span>
                            </Label>
                            <Label>
                              End date
                              <Input
                                required
                                name="endDate"
                                type="date"
                                defaultValue={academicYear.end_date}
                              />
                              <span className="text-xs font-normal text-muted-foreground">
                                Example: May 31, 2027
                              </span>
                            </Label>
                            <SubmitButton
                              className="self-end sm:w-fit"
                              pendingLabel="Updating..."
                            >
                              <Save
                                aria-hidden="true"
                                data-icon="inline-start"
                              />
                              Save changes
                            </SubmitButton>
                          </form>
                        </details>

                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                          {academicYear.is_active ? null : (
                            <form action={setActiveAcademicYear}>
                              <input
                                name="academicYearId"
                                type="hidden"
                                value={academicYear.id}
                              />
                              <SubmitButton
                                variant="outline"
                                className="w-full sm:w-auto"
                                pendingLabel="Updating..."
                              >
                                <CheckCircle2
                                  aria-hidden="true"
                                  data-icon="inline-start"
                                />
                                Mark active
                              </SubmitButton>
                            </form>
                          )}
                          <form action={deleteAcademicYear}>
                            <input
                              name="academicYearId"
                              type="hidden"
                              value={academicYear.id}
                            />
                            <ConfirmSubmitButton
                              type="submit"
                              variant="destructive"
                              className="w-full sm:w-auto"
                              confirmMessage={`Delete ${academicYear.name}? This is only allowed when no attendance records are linked.`}
                              confirmTitle="Delete academic year?"
                              confirmDescription={`This will remove ${academicYear.name}. Academic years with linked attendance records cannot be deleted. This action cannot be undone.`}
                              confirmLabel="Delete academic year"
                              pendingLabel="Deleting..."
                            >
                              <Trash2
                                aria-hidden="true"
                                data-icon="inline-start"
                              />
                              Delete
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  actionHref={
                    canManageAcademicYears
                      ? "/dashboard/settings/academic-years#create-academic-year"
                      : undefined
                  }
                  actionLabel="Create academic year"
                  title="No academic years created yet"
                  description="Create an academic year to organize attendance and future reports."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
