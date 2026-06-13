import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Save,
  Users,
} from "lucide-react";

import { ActionMessage } from "@/components/dashboard/ActionMessage";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  getTestDetail,
  listTestScores,
} from "@/lib/tests/queries";
import {
  bulkUpdateTestScores,
  syncTestScoresAction,
  updateTest,
} from "@/lib/tests/actions";
import { requirePermission, type DashboardContext } from "@/lib/auth/permissions";
import { formatDate, formatTimestamp } from "@/lib/formatters/date";

type TestDetailPageProps = {
  params: Promise<{
    testId: string;
  }>;
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

async function getTeacherAssignedBatchIds(context: DashboardContext) {
  const teacherMembershipIds = context.memberships
    .filter((membership) => membership.role === "teacher")
    .map((membership) => membership.id);

  if (!teacherMembershipIds.length) {
    return new Set<string>();
  }

  const { data, error } = await context.supabase
    .from("batch_teachers")
    .select("batch_id")
    .in("membership_id", teacherMembershipIds);

  if (error) {
    console.error("test detail teacher batch list failed", error);
    return new Set<string>();
  }

  return new Set((data ?? []).map((row) => row.batch_id).filter(Boolean));
}

export default async function TestDetailPage({ params, searchParams }: TestDetailPageProps) {
  const { testId } = await params;
  const sParams = await searchParams;
  const context = await requirePermission("tests.view");
  const { claims, institute, profile, role } = context;

  const test = await getTestDetail(testId);
  if (!test) {
    redirect("/dashboard/tests?error=Test not found.");
  }

  // Teacher scope check
  let isAssignedTeacher = true;
  if (role === "teacher") {
    const teacherBatches = await getTeacherAssignedBatchIds(context);
    isAssignedTeacher = teacherBatches.has(test.batch_id);
    if (!isAssignedTeacher) {
      redirect("/dashboard/access-denied");
    }
  }

  const scores = await listTestScores(testId);

  // Check update permission
  const canUpdate =
    role === "owner" ||
    (role === "teacher" && isAssignedTeacher) ||
    (["branch_manager", "academic_coordinator"].includes(role) && test.branch_id === context.branchId);

  // Performance calculations
  const totalStudents = scores.length;
  const marksEntered = scores.filter((s) => s.status !== "not_entered").length;
  const absentCount = scores.filter((s) => s.status === "absent").length;
  const excusedCount = scores.filter((s) => s.status === "excused").length;

  const presentScores = scores.filter((s) => s.status === "present" && s.marks_obtained !== null);
  let averageMarks = 0;
  let highestMarks = 0;
  let lowestMarks = 0;
  let averagePercentage = 0;

  if (presentScores.length > 0) {
    const marks = presentScores.map((s) => Number(s.marks_obtained!));
    const totalMarks = marks.reduce((sum, m) => sum + m, 0);
    averageMarks = totalMarks / presentScores.length;
    highestMarks = Math.max(...marks);
    lowestMarks = Math.min(...marks);
    averagePercentage = (averageMarks / test.max_marks) * 100;
  }

  return (
    <DashboardShell
      activePage="tests"
      instituteName={institute.name}
      role={role}
      title="Test Detail & Score Entry"
      userEmail={claims.email}
      userName={profile.full_name}
    >
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/tests">
                <ArrowLeft className="size-4 mr-1.5" />
                Back to tests
              </Link>
            </Button>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">
              {test.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {test.batches?.name ?? "Batch"} &bull; {test.subject ?? "No subject"} &bull; {test.branches?.name ?? "Branch"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Badge variant={test.status === "completed" ? "secondary" : test.status === "marks_entry" ? "default" : "outline"}>
              {test.status.replace("_", " ")}
            </Badge>
            {canUpdate && test.status !== "completed" ? (
              <form action={updateTest}>
                <input name="testId" type="hidden" value={test.id} />
                <input name="title" type="hidden" value={test.title} />
                <input name="testDate" type="hidden" value={test.test_date} />
                <input name="maxMarks" type="hidden" value={test.max_marks} />
                <input name="status" type="hidden" value="completed" />
                <SubmitButton size="sm" variant="outline" pendingLabel="Marking completed...">
                  <CheckCircle2 className="size-4 mr-1.5" />
                  Mark Completed
                </SubmitButton>
              </form>
            ) : null}
            {canUpdate ? (
              <form action={syncTestScoresAction}>
                <input name="testId" type="hidden" value={test.id} />
                <SubmitButton size="sm" variant="outline" pendingLabel="Syncing...">
                  <RefreshCw className="size-4 mr-1.5" />
                  Sync missing students
                </SubmitButton>
              </form>
            ) : null}
          </div>
        </div>

        <ActionMessage error={sParams.error} success={sParams.success} />

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Class Average</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">
                {presentScores.length > 0 ? `${averageMarks.toFixed(2)} / ${test.max_marks}` : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {presentScores.length > 0 ? `${averagePercentage.toFixed(1)}% Avg Percentage` : "No scores entered"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Highest Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {presentScores.length > 0 ? `${highestMarks.toFixed(2)}` : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Max possible: {test.max_marks}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Lowest Score</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                {presentScores.length > 0 ? `${lowestMarks.toFixed(2)}` : "-"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                From present students
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">Participation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tracking-tight">
                {marksEntered} / {totalStudents}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Absent: {absentCount} &bull; Excused: {excusedCount}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Test Summary</CardTitle>
            {test.description ? (
              <CardDescription className="mt-2 text-sm text-foreground whitespace-pre-line">
                {test.description}
              </CardDescription>
            ) : (
              <CardDescription>No description provided for this test.</CardDescription>
            )}
            <div className="grid gap-2 sm:grid-cols-3 text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" />
                Date: {formatDate(test.test_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Award className="size-4" />
                Max Marks: {test.max_marks}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-4" />
                Total Students Enrolled: {totalStudents}
              </span>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Student Grades & Marks</CardTitle>
            <CardDescription>
              {canUpdate ? "Record or edit scores, status, and remarks for each student." : "View scores, status, and remarks for this test."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scores.length ? (
              <form action={bulkUpdateTestScores} className="grid gap-6">
                <input name="testId" type="hidden" value={test.id} />
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50 font-medium text-muted-foreground">
                        <th className="p-4">Student Name</th>
                        <th className="p-4 w-44">Status</th>
                        <th className="p-4 w-36">Marks Obtained</th>
                        <th className="p-4 w-28">Percentage</th>
                        <th className="p-4">Remarks</th>
                        <th className="p-4">Checked Info</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {scores.map((score) => {
                        const scorePercentage =
                          score.status === "present" && score.marks_obtained !== null
                            ? (Number(score.marks_obtained) / test.max_marks) * 100
                            : null;

                        return (
                          <tr key={score.student_id} className="hover:bg-muted/10">
                            <td className="p-4 font-medium text-foreground">
                              <Link href={`/dashboard/students/${score.student_id}`} className="hover:underline">
                                {score.students?.full_name ?? "Student"}
                              </Link>
                            </td>
                            <td className="p-4">
                              <select
                                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                                defaultValue={score.status}
                                disabled={!canUpdate}
                                name={`status-${score.student_id}`}
                              >
                                <option value="not_entered">Not Entered</option>
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="excused">Excused</option>
                              </select>
                            </td>
                            <td className="p-4">
                              <Input
                                className="h-9 text-xs"
                                defaultValue={score.marks_obtained ?? ""}
                                disabled={!canUpdate}
                                max={test.max_marks}
                                min={0}
                                name={`marks-${score.student_id}`}
                                placeholder="Marks"
                                step="0.01"
                                type="number"
                              />
                            </td>
                            <td className="p-4 text-xs font-semibold text-muted-foreground">
                              {scorePercentage !== null ? `${scorePercentage.toFixed(1)}%` : "-"}
                            </td>
                            <td className="p-4">
                              <Input
                                className="h-9 text-xs"
                                defaultValue={score.remarks ?? ""}
                                disabled={!canUpdate}
                                name={`remarks-${score.student_id}`}
                                placeholder="Optional remarks"
                                type="text"
                              />
                            </td>
                            <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                              {score.checked_at ? (
                                <div className="grid">
                                  <span>{formatTimestamp(score.checked_at)}</span>
                                  <span className="text-[10px] text-muted-foreground/80">
                                    By {score.profiles?.full_name ?? "Staff"}
                                  </span>
                                </div>
                              ) : (
                                "-"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {canUpdate ? (
                  <div className="flex justify-end">
                    <SubmitButton pendingLabel="Saving scores..." className="w-full sm:w-auto">
                      <Save className="size-4 mr-1.5" />
                      Save all scores
                    </SubmitButton>
                  </div>
                ) : null}
              </form>
            ) : (
              <EmptyState
                title="No students assigned"
                description="Assign students to this batch or sync them to start entering marks."
              />
            )}
          </CardContent>
        </Card>
      </section>
    </DashboardShell>
  );
}
