"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotificationFeed } from "@/components/dashboard/use-notification-feed";
import type { NotificationItem } from "@/lib/communication/constants";
import { formatDate } from "@/lib/formatters/date";

function getPriorityVariant(priority: NotificationItem["priority"]) {
  if (priority === "urgent") {
    return "destructive" as const;
  }

  if (priority === "high") {
    return "secondary" as const;
  }

  return "outline" as const;
}

function getTypeLabel(type: NotificationItem["type"]) {
  return type.replaceAll("_", " ");
}

type NotificationBellProps = {
  notifications: NotificationItem[];
  unreadCount: number;
};

export function NotificationBell({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { markAllRead, markRead, notifications, pendingAction, unreadCount } =
    useNotificationFeed({
      initialNotifications,
      initialUnreadCount,
      limit: 8,
    });

  return (
    <details
      className="relative max-w-full"
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      open={isOpen}
    >
      <summary className="group flex h-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Open notifications</span>
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount ? (
          <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </summary>

      <div className="absolute right-0 z-30 mt-2 w-[min(calc(100vw-2rem),24rem)] max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-card p-3 shadow-xl shadow-primary/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Latest notices for your role and branch.
            </p>
          </div>
          {unreadCount ? (
            <Button
              disabled={pendingAction !== null}
              onClick={() => void markAllRead()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <CheckCheck aria-hidden="true" data-icon="inline-start" />
              Mark all
            </Button>
          ) : null}
        </div>

        <div className="mt-3 max-h-80 max-w-full overflow-y-auto rounded-md border border-border">
          {notifications.length ? (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={
                    notification.unread
                      ? "bg-primary/5 p-3"
                      : "bg-background p-3"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium">
                        {notification.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {notification.body}
                      </p>
                    </div>
                    {notification.unread ? (
                      <span
                        aria-label="Unread"
                        className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                      />
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant={getPriorityVariant(notification.priority)}>
                      {notification.priority}
                    </Badge>
                    <Badge variant="outline" className="capitalize">
                      {getTypeLabel(notification.type)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(notification.created_at)}
                    </span>
                  </div>

                  {notification.unread ? (
                    <Button
                      className="mt-2"
                      disabled={pendingAction !== null}
                      onClick={() => void markRead(notification.id)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      {pendingAction === notification.id
                        ? "Updating..."
                        : "Mark as read"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </div>

        <Button asChild className="mt-3 w-full" variant="outline">
          <Link href="/dashboard/communication">View communication hub</Link>
        </Button>
      </div>
    </details>
  );
}
