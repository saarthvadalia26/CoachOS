"use client";

import { useCallback, useEffect, useState } from "react";

import type { NotificationItem } from "@/lib/communication/constants";
import { errorToast } from "@/lib/toast";

export const notificationPollIntervalMs = 25_000;

type NotificationFeedResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
};

async function fetchNotificationFeed(limit: number) {
  const response = await fetch(
    `/dashboard/communication/notifications?limit=${limit}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Notification feed could not be refreshed.");
  }

  return (await response.json()) as NotificationFeedResponse;
}

async function updateNotificationFeed({
  action,
  limit,
  notificationId,
}: {
  action: "mark_all_read" | "mark_read";
  limit: number;
  notificationId?: string;
}) {
  const response = await fetch(
    `/dashboard/communication/notifications?limit=${limit}`,
    {
      body: JSON.stringify({ action, notificationId }),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error("Notification could not be updated.");
  }

  return (await response.json()) as NotificationFeedResponse;
}

export function useNotificationFeed({
  initialNotifications,
  initialUnreadCount,
  limit,
}: {
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
  limit: number;
}) {
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const applyFeed = useCallback((feed: NotificationFeedResponse) => {
    setNotifications(feed.notifications);
    setUnreadCount(feed.unreadCount);
  }, []);

  const refresh = useCallback(
    async ({ silent = true }: { silent?: boolean } = {}) => {
      try {
        applyFeed(await fetchNotificationFeed(limit));
      } catch (error) {
        if (!silent) {
          errorToast("Notifications could not be refreshed.");
        } else if (process.env.NODE_ENV !== "production") {
          console.debug("Notification background refresh failed", error);
        }
      }
    },
    [applyFeed, limit],
  );

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, notificationPollIntervalMs);

    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  async function markRead(notificationId: string) {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setPendingAction(notificationId);
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) =>
        notification.id === notificationId
          ? { ...notification, unread: false }
          : notification,
      ),
    );
    setUnreadCount((currentUnreadCount) =>
      Math.max(currentUnreadCount - 1, 0),
    );

    try {
      applyFeed(
        await updateNotificationFeed({
          action: "mark_read",
          limit,
          notificationId,
        }),
      );
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      errorToast("Notification could not be updated.");
    } finally {
      setPendingAction(null);
    }
  }

  async function markAllRead() {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setPendingAction("all");
    setNotifications((currentNotifications) =>
      currentNotifications.map((notification) => ({
        ...notification,
        unread: false,
      })),
    );
    setUnreadCount(0);

    try {
      applyFeed(
        await updateNotificationFeed({
          action: "mark_all_read",
          limit,
        }),
      );
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
      errorToast("Notifications could not be updated.");
    } finally {
      setPendingAction(null);
    }
  }

  return {
    markAllRead,
    markRead,
    notifications,
    pendingAction,
    refresh,
    unreadCount,
  };
}
