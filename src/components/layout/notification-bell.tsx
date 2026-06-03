"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/rbac";
import {
  subscribeNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/services/notifications";
import type { Notification } from "@/types";

function notificationHref(n: Notification): string {
  if (n.entityType === "candidate" && n.entityId) {
    return `/candidates/${n.entityId}`;
  }
  if (n.entityType === "followup") return "/followups";
  return "/dashboard";
}

export function NotificationBell() {
  const router = useRouter();
  const { profile, role } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeNotifications(profile.id, isAdmin(role), setNotifications);
    return () => unsub();
  }, [profile?.id, role]);

  const unread = notifications.filter((n) => !n.read).length;

  const handleOpen = async (n: Notification) => {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    router.push(notificationHref(n));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative"
        )}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-normal text-primary hover:underline"
              onClick={() => markAllNotificationsRead(notifications)}
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No notifications yet
          </p>
        ) : (
          notifications.slice(0, 12).map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() => handleOpen(n)}
              className={cn(
                "flex flex-col items-start gap-0.5 py-2.5",
                !n.read && "bg-primary/5"
              )}
            >
              <span className="text-sm font-medium">{n.title}</span>
              <span className="text-xs text-muted-foreground line-clamp-2">{n.body}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(n.createdAt, { addSuffix: true })}
              </span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
