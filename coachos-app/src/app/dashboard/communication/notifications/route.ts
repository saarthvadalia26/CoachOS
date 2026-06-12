import { NextResponse, type NextRequest } from "next/server";

import {
  canAccessPermission,
  requirePermission,
} from "@/lib/auth/permissions";
import {
  getNotificationFeed,
  markAllNotificationsReadForContext,
  markNotificationReadForContext,
} from "@/lib/communication/notifications";

export const dynamic = "force-dynamic";

function getLimit(request: NextRequest) {
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? 8);

  if (!Number.isFinite(rawLimit)) {
    return 8;
  }

  return Math.min(Math.max(Math.floor(rawLimit), 1), 30);
}

function noStoreJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePermission("notifications.view");

    if (!canAccessPermission(context, "notifications.view")) {
      return noStoreJson({ notifications: [], unreadCount: 0 });
    }

    return noStoreJson(await getNotificationFeed(context, getLimit(request)));
  } catch (error) {
    console.error("notification feed refresh failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return noStoreJson({ notifications: [], unreadCount: 0 });
  }
}

export async function POST(request: NextRequest) {
  const limit = getLimit(request);

  try {
    const context = await requirePermission("notifications.update");
    const body = (await request.json().catch(() => null)) as {
      action?: string;
      notificationId?: string;
    } | null;

    if (body?.action === "mark_read") {
      if (!body.notificationId) {
        return noStoreJson(
          { error: "Notification could not be updated." },
          { status: 400 },
        );
      }

      await markNotificationReadForContext(context, body.notificationId);
    } else if (body?.action === "mark_all_read") {
      await markAllNotificationsReadForContext(context);
    } else {
      return noStoreJson(
        { error: "Notification could not be updated." },
        { status: 400 },
      );
    }

    return noStoreJson(await getNotificationFeed(context, limit));
  } catch (error) {
    console.error("notification update request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return noStoreJson(
      { error: "Notification could not be updated." },
      { status: 500 },
    );
  }
}
