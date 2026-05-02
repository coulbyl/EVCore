"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/domains/notification/use-cases/use-notifications";

export function NotificationBell() {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  const display = count > 9 ? "9+" : count > 0 ? String(count) : null;

  return (
    <Link
      href="/dashboard/notifications"
      title="Notifications"
      className="relative flex min-h-11 items-center justify-center rounded-xl border border-border bg-panel-strong px-3 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      <Bell size={16} />
      {display && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.58rem] font-bold text-destructive-foreground">
          {display}
        </span>
      )}
    </Link>
  );
}
