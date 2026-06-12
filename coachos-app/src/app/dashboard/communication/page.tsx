import type { Metadata } from "next";
import { Bell, Megaphone, Save, Send, Trash2 } from "lucide-react";

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
  canAccessPermission,
  type DashboardContext,
} from "@/lib/auth/permissions";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateAnnouncement,
} from "@/lib/communication/actions";
import {
  communicationAudiences,
  communicationPriorities,
  type CommunicationAudience,
  type CommunicationPriority,
  type NotificationItem,
} from "@/lib/communication/constants";
import { formatTimestamp } from "@/lib/formatters/date";

export const metadata: Metadata = {
  title: "Communication",
};

type CommunicationPageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type AnnouncementRow = {
  audience: string;
  body: string;
  branch_id: string | null;
  created_at: string;
  created_by: string | null;
  id: string;
  priority: string;
  title: string;
  updated_at: string | null;
};

type CreatorRow = {
  full_name: string | null;
  id: string;
};

const audienceLabels: Record<CommunicationAudience, string> = {
  all_staff: "All staff",
  branch_staff: "Branch staff",
  owners: "Owners",
  branch_managers: "Branch managers",
  operations_staff: "Operations staff",
  accountants: "Accountants",
  academic_coordinators: "Academic coordinators",
  teachers: "Teachers",
};

const priorityLabels: Record<CommunicationPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

function getAudienceLabel(value: string) {
  return audienceLabels[value as CommunicationAudience] ?? "Team";
}

function getPriorityLabel(value: string) {
  return priorityLabels[value as CommunicationPriority] ?? "Normal";
}

function getPriorityVariant(priority: string) {
  if (priority === "urgent") {
    return "destructive" as const;
  }

  if (priority === "high") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function getNotificationTypeLabel(type: NotificationItem["type"]) {
  if (type === "fee_reminder") {
    return "Fee follow-up";
  }

  if (type === "attendance_alert") {
    return "Attendance alert";
  }

  if (type === "system") {
    return "System notice";
  }

  return "Announcement";
}

function getBranchLabel(
  context: Pick<DashboardContext, "accessibleBranches">,
  branchId: string | null,
) {
  if (!branchId) {
    return "All branches";
  }

  return (
    context.accessibleBranches.find((branch) => branch.id === branchId)?.name ??
    "Assigned branch"
  );
}

function canCreateAnnouncement(context: DashboardContext) {
  if (context.role === "owner") {
    return canAccessPermission(context, "communications.create", {
      instituteId: context.institute.id,
    });
  }

  return Boolean(
    context.branchId &&
      canAccessPermission(context, "communications.create", {
        branchId: context.branchId,
      }),
  );
}

function canManageAnnouncement(
  context: DashboardContext,
  announcement: Pick<AnnouncementRow, "branch_id">,
) {
  if (!announcement.branch_id) {
    return context.role === "owner";
  }

  return canAccessPermission(context, "communications.update", {
    branchId: announcement.branch_id,
  });
}

function BranchSelect({
  context,
  defaultValue,
}: {
  context: DashboardContext;
  defaultValue?: string | null;
}) {
  if (context.role === "owner") {
    return (
      <Label>
        Branch
        <select
          name="branchId"
          defaultValue={defaultValue ?? "all"}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
        >
          <option value="all">All branches</option>
          {context.accessibleBranches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </Label>
    );
  }

  return (
    <div className="grid gap-2 text-sm">
      <span className="font-medium">Branch</span>
      <input name="branchId" type="hidden" value={context.branchId ?? ""} />
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
        {getBranchLabel(context, context.branchId)}
      </p>
    </div>
  );
}

function AudienceSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Label>
      Audience
      <select
        name="audience"
        defaultValue={defaultValue ?? "all_staff"}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {communicationAudiences.map((audience) => (
          <option key={audience} value={audience}>
            {audienceLabels[audience]}
          </option>
        ))}
      </select>
    </Label>
  );
}

function PrioritySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Label>
      Priority
      <select
        name="priority"
        defaultValue={defaultValue ?? "normal"}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
      >
        {communicationPriorities.map((priority) => (
          <option key={priority} value={priority}>
            {priorityLabels[priority]}
          </option>
        ))}
      </select>
    </Label>
  );
}

function MessageField({
  defaultValue,
  name = "body",
}: {
  defaultValue?: string;
  name?: string;
}) {
  return (
    <Label>
      Message
      <textarea
        required
        name={name}
        defaultValue={defaultValue}
        rows={5}
        placeholder="Share a clear internal update for the selected audience."
        className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </Label>
  );
}

async function getCreatorNames(
  context: DashboardContext,
  announcements: AnnouncementRow[],
) {
  const creatorIds = Array.from(
    new Set(
      announcements
        .map((announcement) => announcement.created_by)
        .filter((creatorId): creatorId is string => Boolean(creatorId)),
    ),
  );

  if (!creatorIds.length) {
    return new Map<string, string>();
  }

  const { data, error } = await context.supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", creatorIds);

  if (error) {
    console.error("communication creator lookup failed", {
      code: error.code,
      details: error.details,
      hint: error.hint,
      message: error.message,
    });
    return new Map<string, string>();
  }

  return new Map(
    ((data ?? []) as CreatorRow[]).map((creator) => [
      creator.id,
      creator.full_name ?? "Team member",
    ]),
  );
}

function AnnouncementComposer({
  context,
}: {
  context: DashboardContext;
}) {
  return (
    <Card id="new-announcement">
      <CardHeader>
        <CardTitle className="text-xl">Publish announcement</CardTitle>
        <CardDescription>
          Share an internal notice with institute or branch staff.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={createAnnouncement} className="grid gap-4">
          <Label>
            Title
            <Input
              required
              name="title"
              type="text"
              placeholder="Monthly test schedule update"
            />
          </Label>
          <MessageField />
          <div className="grid gap-4 md:grid-cols-3">
            <BranchSelect context={context} />
            <AudienceSelect />
            <PrioritySelect />
          </div>
          <SubmitButton className="w-full sm:w-fit" pendingLabel="Publishing...">
            <Send aria-hidden="true" data-icon="inline-start" />
            Publish announcement
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}

function AnnouncementCard({
  announcement,
  canManage,
  context,
  creatorName,
}: {
  announcement: AnnouncementRow;
  canManage: boolean;
  context: DashboardContext;
  creatorName: string;
}) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="min-w-0">
          <CardTitle className="flex items-start gap-2 text-lg">
            <Megaphone
              aria-hidden="true"
              className="mt-1 size-4 shrink-0 text-muted-foreground"
            />
            <span className="break-words">{announcement.title}</span>
          </CardTitle>
          <CardDescription className="mt-2 leading-6">
            {announcement.body}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
          <Badge variant={getPriorityVariant(announcement.priority)}>
            {getPriorityLabel(announcement.priority)}
          </Badge>
          <Badge variant="outline">
            {getAudienceLabel(announcement.audience)}
          </Badge>
          <Badge variant="outline">
            {getBranchLabel(context, announcement.branch_id)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="whitespace-nowrap">
            Published {formatTimestamp(announcement.created_at)}
          </span>
          <span className="hidden sm:inline text-muted-foreground/50">|</span>
          <span className="whitespace-nowrap">By {creatorName}</span>
        </div>

        {canManage ? (
          <details className="rounded-md border border-border bg-muted/30 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Edit announcement
            </summary>
            <div className="mt-4 grid gap-4">
              <form action={updateAnnouncement} className="grid gap-4">
                <input
                  name="announcementId"
                  type="hidden"
                  value={announcement.id}
                />
                <Label>
                  Title
                  <Input
                    required
                    name="title"
                    type="text"
                    defaultValue={announcement.title}
                  />
                </Label>
                <MessageField defaultValue={announcement.body} />
                <div className="grid gap-4 md:grid-cols-3">
                  <BranchSelect
                    context={context}
                    defaultValue={announcement.branch_id}
                  />
                  <AudienceSelect defaultValue={announcement.audience} />
                  <PrioritySelect defaultValue={announcement.priority} />
                </div>
                <SubmitButton
                  className="w-full sm:w-auto"
                  pendingLabel="Updating..."
                >
                  <Save aria-hidden="true" data-icon="inline-start" />
                  Save changes
                </SubmitButton>
              </form>
              <form action={deleteAnnouncement}>
                <input
                  name="announcementId"
                  type="hidden"
                  value={announcement.id}
                />
                <ConfirmSubmitButton
                  className="w-full sm:w-auto"
                  confirmMessage={`Delete the announcement "${announcement.title}"?`}
                  pendingLabel="Deleting..."
                  variant="destructive"
                >
                  <Trash2 aria-hidden="true" data-icon="inline-start" />
                  Delete
                </ConfirmSubmitButton>
              </form>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}

function NotificationsPanel({
  notifications,
}: {
  notifications: NotificationItem[];
}) {
  const unreadCount = notifications.filter((notification) => notification.unread)
    .length;

  return (
    <Card>
      <CardHeader className="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Bell aria-hidden="true" className="size-5 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>
            Role-aware notices for your institute and branch.
          </CardDescription>
        </div>
        {unreadCount ? (
          <form action={markAllNotificationsRead}>
            <input name="next" type="hidden" value="/dashboard/communication" />
            <SubmitButton
              className="w-full sm:w-auto"
              pendingLabel="Updating..."
              variant="outline"
            >
              Mark all as read
            </SubmitButton>
          </form>
        ) : null}
      </CardHeader>
      <CardContent>
        {notifications.length ? (
          <div className="divide-y divide-border rounded-lg border border-border">
            {notifications.map((notification) => (
              <article
                key={notification.id}
                className={
                  notification.unread
                    ? "grid gap-3 bg-primary/5 p-4"
                    : "grid gap-3 p-4"
                }
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-medium">
                      {notification.title}
                    </h3>
                    <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">
                      {notification.body}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-start gap-2 sm:justify-end">
                    {notification.unread ? (
                      <Badge>Unread</Badge>
                    ) : (
                      <Badge variant="outline">Read</Badge>
                    )}
                    <Badge variant={getPriorityVariant(notification.priority)}>
                      {getPriorityLabel(notification.priority)}
                    </Badge>
                    <Badge variant="outline">
                      {getNotificationTypeLabel(notification.type)}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    {formatTimestamp(notification.created_at)}
                  </p>
                  {notification.unread ? (
                    <form action={markNotificationRead}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <input
                        name="next"
                        type="hidden"
                        value="/dashboard/communication"
                      />
                      <SubmitButton
                        className="w-full sm:w-auto"
                        pendingLabel="Updating..."
                        variant="outline"
                      >
                        Mark as read
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No notifications yet"
            description="Notifications will appear here when announcements, fee follow-ups, or attendance alerts are created for your role."
          />
        )}
      </CardContent>
    </Card>
  );
}

export default async function CommunicationPage({
  searchParams,
}: CommunicationPageProps) {
  const [{ announcements, context, error }, notificationResult, params] =
    await Promise.all([
      listAnnouncements(),
      listNotifications(30),
      searchParams,
    ]);
  const creatorNames = await getCreatorNames(
    context,
    announcements as AnnouncementRow[],
  );
  const canCreate = canCreateAnnouncement(context);
  const hasLoadError = Boolean(error);

  return (
    <DashboardShell
      activePage="communication"
      instituteName={context.institute.name}
      role={context.role}
      title="Communication"
      userEmail={context.claims.email}
      userName={context.profile.full_name}
    >
      <section className="grid gap-6">
        <ActionMessage
          error={
            hasLoadError || params.error
              ? params.error ??
                "Communication records are unavailable right now. Please try again."
              : null
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Communication Hub</CardTitle>
            <CardDescription>
              Publish in-app announcements and review notifications for your
              institute. External email, SMS, WhatsApp, and push delivery are
              not enabled in this version.
            </CardDescription>
          </CardHeader>
        </Card>

        {canCreate ? <AnnouncementComposer context={context} /> : null}

        <NotificationsPanel notifications={notificationResult.notifications} />

        <div className="grid gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Announcements
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Updates visible to your role and branch.
              </p>
            </div>
            <Badge variant="outline">
              {announcements.length}{" "}
              {announcements.length === 1 ? "announcement" : "announcements"}
            </Badge>
          </div>

          {announcements.length ? (
            <div className="grid gap-4">
              {(announcements as AnnouncementRow[]).map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  canManage={canManageAnnouncement(context, announcement)}
                  context={context}
                  creatorName={
                    announcement.created_by
                      ? creatorNames.get(announcement.created_by) ??
                        "Team member"
                      : "Team member"
                  }
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-5">
                <EmptyState
                  actionHref={canCreate ? "#new-announcement" : undefined}
                  actionLabel="Publish announcement"
                  title="No announcements yet"
                  description={
                    canCreate
                      ? "Publish the first announcement to keep staff aligned across branches."
                      : "Announcements shared with your role and branch will appear here."
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
