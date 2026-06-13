import Link from "next/link";
import type { Metadata } from "next";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { PortalShell } from "@/components/portal/PortalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  title: "Parent Portal",
};

type ParentPortalPageProps = {
  searchParams: Promise<{
    studentId?: string;
  }>;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    currency: "INR",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatScore(marksObtained: number | null, maxMarks: number) {
  if (marksObtained === null) {
    return "Not entered";
  }

  return `${marksObtained} / ${maxMarks}`;
}

export default async function ParentPortalPage({
  searchParams,
}: ParentPortalPageProps) {
  const context = await getPortalContext("parent");
  const params = await searchParams;
  const selectedStudent =
    context.students.find((student) => student.id === params.studentId) ??
    context.students[0] ??
    null;
  const message = getPortalStatusMessage("parent", context.status);

  return (
    <PortalShell
      description="View your linked children’s attendance, homework, test results, and fee records."
      email={context.claims.email}
      title="Parent Portal"
    >
      {!selectedStudent ? (
        <Card>
          <CardHeader>
            <CardTitle>Portal access unavailable</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ParentPortalContent
          context={context}
          selectedStudent={selectedStudent}
        />
      )}
    </PortalShell>
  );
}

async function ParentPortalContent({
  context,
  selectedStudent,
}: {
  context: Awaited<ReturnType<typeof getPortalContext>>;
  selectedStudent: NonNullable<Awaited<ReturnType<typeof getPortalContext>>["students"][number]>;
}) {
  const data = await getPortalStudentData(context, selectedStudent, {
    includeFees: true,
  });
  const feeSummary = data.fees.reduce(
    (summary, record) => {
      summary.totalDue += record.amountDue;
      summary.totalPaid += record.amountPaid;
      summary.pending += record.pendingAmount;

      return summary;
    },
    {
      pending: 0,
      totalDue: 0,
      totalPaid: 0,
    },
  );
  const recentAttendance = data.attendanceEntries.slice(0, 6);

  return (
    <section className="grid gap-6">
      {context.students.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Select student</CardTitle>
            <CardDescription>
              Choose a linked child to view their records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {context.students.map((student) => (
                <Button
                  key={student.id}
                  asChild
                  size="sm"
                  variant={
                    student.id === selectedStudent.id ? "default" : "outline"
                  }
                >
                  <Link href={`/portal/parent?studentId=${student.id}`}>
                    {student.full_name}
                  </Link>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">
            {selectedStudent.full_name}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Read-only student summary for parents and guardians.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedStudent.archived_at ? (
            <Badge variant="outline">Archived</Badge>
          ) : null}
          <Badge
            variant={
              selectedStudent.status === "inactive" ? "outline" : "secondary"
            }
          >
            {selectedStudent.status === "inactive" ? "Inactive" : "Active"}
          </Badge>
        </div>
      </div>

      {selectedStudent.archived_at ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This student record is archived. Historical information remains
          available in read-only mode.
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
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
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              Total paid
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(feeSummary.totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-muted-foreground">
              Pending fees
            </p>
            <p className="mt-2 text-2xl font-semibold">
              {formatCurrency(feeSummary.pending)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent attendance</CardTitle>
            <CardDescription>Latest attendance records.</CardDescription>
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
                    <Badge
                      variant={
                        entry.status === "absent" ? "destructive" : "secondary"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No attendance records"
                description="No attendance records have been published for this student."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fee records</CardTitle>
            <CardDescription>Payment status and pending balance.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.fees.length ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {data.fees.map((record) => (
                  <article key={record.id} className="grid gap-2 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Due {formatCurrency(record.amountDue)}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Due date: {formatDate(record.dueDate)}
                        </p>
                      </div>
                      <Badge variant="outline">{record.status ?? "pending"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Paid {formatCurrency(record.amountPaid)} | Pending{" "}
                      {formatCurrency(record.pendingAmount)}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No fee records"
                description="No fee records are available for this student."
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
                description="No homework has been assigned to this student yet."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tests and exams</CardTitle>
            <CardDescription>Published test performance.</CardDescription>
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
