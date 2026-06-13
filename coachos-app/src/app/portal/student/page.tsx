import type { Metadata } from "next";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate } from "@/lib/formatters/date";
import { getPortalContext, getPortalStatusMessage } from "@/lib/portal/context";
import { getPortalStudentData } from "@/lib/portal/data";

export const metadata: Metadata = {
  title: "Student Portal",
};

function formatScore(marksObtained: number | null, maxMarks: number) {
  if (marksObtained === null) {
    return "Not entered";
  }

  return `${marksObtained} / ${maxMarks}`;
}

export default async function StudentPortalPage() {
  const context = await getPortalContext("student");
  const student = context.students[0] ?? null;
  const message = getPortalStatusMessage("student", context.status);

  return (
    <PortalShell
      description="View your batches, attendance, homework, and test performance."
      email={context.claims.email}
      title="Student Portal"
    >
      {!student ? (
        <Card>
          <CardHeader>
            <CardTitle>Portal access unavailable</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <StudentPortalContent context={context} student={student} />
      )}
    </PortalShell>
  );
}

async function StudentPortalContent({
  context,
  student,
}: {
  context: Awaited<ReturnType<typeof getPortalContext>>;
  student: NonNullable<Awaited<ReturnType<typeof getPortalContext>>["students"][number]>;
}) {
  const data = await getPortalStudentData(context, student, {
    includeFees: false,
  });
  const recentAttendance = data.attendanceEntries.slice(0, 8);

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">
            {student.full_name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only academic summary from your institute.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {student.archived_at ? <Badge variant="outline">Archived</Badge> : null}
          <Badge variant={student.status === "inactive" ? "outline" : "secondary"}>
            {student.status === "inactive" ? "Inactive" : "Active"}
          </Badge>
        </div>
      </div>

      {student.archived_at ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This student record is archived. Historical information remains
          available in read-only mode.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              Assigned batches
            </p>
            <p className="mt-2 text-2xl font-semibold">{data.batches.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              Attendance
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {data.attendancePercentage}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              Homework
            </p>
            <p className="mt-2 text-2xl font-semibold">{data.homework.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Assigned batches</CardTitle>
            <CardDescription>Your current batch enrollments.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.batches.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.batches.map((batch) => (
                  <article key={batch.id} className="p-4">
                    <h3 className="text-sm font-semibold">{batch.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {batch.subject ?? "Subject not specified"}
                      {batch.schedule ? ` | ${batch.schedule}` : ""}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No batches assigned"
                description="Your institute has not assigned you to a batch yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent attendance</CardTitle>
            <CardDescription>Your latest attendance records.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAttendance.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {recentAttendance.map((entry) => (
                  <article
                    key={`${entry.sessionDate}-${entry.batch?.id ?? "batch"}`}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div>
                      <h3 className="text-sm font-semibold">
                        {formatDate(entry.sessionDate)}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.batch?.name ?? "Batch"}
                      </p>
                    </div>
                    <Badge variant={entry.status === "absent" ? "destructive" : "secondary"}>
                      {entry.status}
                    </Badge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No attendance records"
                description="No attendance records have been published for your account."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Homework</CardTitle>
            <CardDescription>Assigned homework and submission status.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.homework.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.homework.map((homework) => (
                  <article key={homework.id} className="grid gap-2 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">
                          {homework.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {homework.batch?.name ?? "Batch"} |{" "}
                          {homework.subject ?? "Subject not specified"}
                        </p>
                      </div>
                      <Badge variant="outline">{homework.submissionStatus}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Due date: {formatDate(homework.dueDate)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No homework assigned"
                description="No homework has been assigned to your batches yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tests and exams</CardTitle>
            <CardDescription>Your latest test performance.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.tests.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.tests.map((test) => (
                  <article key={test.id} className="grid gap-2 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">{test.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {test.subject ?? "Subject not specified"} |{" "}
                          {formatDate(test.testDate)}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {formatScore(test.marksObtained, test.maxMarks)}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No test scores"
                description="No test or exam scores have been published yet."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
