"use client";

import { Bell } from "lucide-react";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { useNotificationFeed } from "@/components/dashboard/use-notification-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NotificationItem } from "@/lib/communication/constants";
import { formatTimestamp } from "@/lib/formatters/date";

function getPriorityLabel(priority: NotificationItem["priority"]) {
  if (priority === "urgent") {
    return "Urgent";
  }

  if (priority === "high") {
    return "High";
  }

  if (priority === "low") {
    return "Low";
  }

  return "Normal";
}

function getPriorityVariant(priority: NotificationItem["priority"]) {
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

export function CommunicationNotificationsPanel({
  notifications: initialNotifications,
}: {
  notifications: NotificationItem[];
}) {
  const { markAllRead, markRead, notifications, pendingAction, unreadCount } =
    useNotificationFeed({
      initialNotifications,
      initialUnreadCount: initialNotifications.filter(
        (notification) => notification.unread,
      ).length,
      limit: 30,
    });

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
          <Button
            className="w-full sm:w-auto"
            disabled={pendingAction !== null}
            onClick={() => void markAllRead()}
            type="button"
            variant="outline"
          >
            {pendingAction === "all" ? "Updating..." : "Mark all as read"}
          </Button>
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
                    <Button
                      className="w-full sm:w-auto"
                      disabled={pendingAction !== null}
                      onClick={() => void markRead(notification.id)}
                      type="button"
                      variant="outline"
                    >
                      {pendingAction === notification.id
                        ? "Updating..."
                        : "Mark as read"}
                    </Button>
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
