import { CalendarDays, CheckCircle2, Plus, Save, Trash2 } from "lucide-react";

import { ConfirmSubmitButton } from "@/components/dashboard/ConfirmSubmitButton";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAcademicYear,
  deleteAcademicYear,
  setActiveAcademicYear,
  updateAcademicYear,
} from "@/lib/academic-years/actions";
import { canAccessPermission, requirePermission } from "@/lib/auth/permissions";

type AcademicYearsPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
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

export default async function AcademicYearsPage({
  searchParams,
}: AcademicYearsPageProps) {
  const context = await requirePermission("academic_years.view");
  const { claims, currentMembership, institute, role, supabase } = context;
  const params = await searchParams;
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
    >
      <section
        className={
          canManageAcademicYears
            ? "grid gap-6 lg:grid-cols-[360px_1fr]"
            : "grid gap-6"
        }
      >
        {canManageAcademicYears ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Create academic year</CardTitle>
              <CardDescription>
                Add an academic year for attendance grouping.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {params.error ? (
                <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {params.error}
                </p>
              ) : null}

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
                    Example name: 2026-27
                  </span>
                </Label>
                <Label>
                  Start date
                  <Input required name="startDate" type="date" />
                  <span className="text-xs font-normal text-muted-foreground">
                    Example start date: 2026-06-01
                  </span>
                </Label>
                <Label>
                  End date
                  <Input required name="endDate" type="date" />
                  <span className="text-xs font-normal text-muted-foreground">
                    Example end date: 2027-05-31
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
                <Button type="submit" className="mt-1">
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Create academic year
                </Button>
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
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Academic years are unavailable right now. Please try again.
            </p>
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
                        {academicYear.start_date} to {academicYear.end_date}
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
                                Example name: 2026-27
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
                                Example start date: 2026-06-01
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
                                Example end date: 2027-05-31
                              </span>
                            </Label>
                            <Button
                              type="submit"
                              className="self-end sm:w-fit"
                            >
                              <Save
                                aria-hidden="true"
                                data-icon="inline-start"
                              />
                              Save changes
                            </Button>
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
                              <Button
                                type="submit"
                                variant="outline"
                                className="w-full sm:w-auto"
                              >
                                <CheckCircle2
                                  aria-hidden="true"
                                  data-icon="inline-start"
                                />
                                Mark active
                              </Button>
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
                <p className="text-sm text-muted-foreground">
                  No academic years have been created yet. Create an academic
                  year to organize attendance and future reports.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
