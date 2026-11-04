"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { clsx as cn } from "clsx";
import { useBell } from "@/domains/notifications/bell-count";

/**
 * La cloche et son badge (09 § 6) : le compte lu par la mise en page du
 * joueur (`useBell`), le même sur le bandeau et la colonne gauche. Il baisse
 * dès qu'une ligne est touchée, et suit la mise en page redessinée après une
 * lecture, un push ou la lecture d'un autre onglet.
 */
export function BellLink({
  labels,
  className,
}: {
  labels: { notifications: string; unread: string };
  className?: string;
}) {
  const count = useBell().count ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0
          ? `${labels.notifications}, ${labels.unread.replace("{count}", String(count))}`
          : labels.notifications
      }
      className={cn(className, "relative")}
    >
      <Bell aria-hidden className="size-5" strokeWidth={1.8} />
      {count > 0 ? (
        <span
          aria-hidden
          className="score absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-led-on px-1 text-legal font-bold text-band"
        >
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
