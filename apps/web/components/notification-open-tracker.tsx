"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { recordProductEvent } from "@/domains/activity/record-product-event";

const FROM_NOTIFICATION = {
  morning: "MORNING_BRIEF",
  weekly: "WEEKLY_STATEMENT",
} as const;

/**
 * Arrivée par la matinée ou le relevé (`?from=morning|weekly`, push ou lien
 * de la notification) : compte une ouverture, puis retire le paramètre pour
 * qu'un rechargement ne la compte pas deux fois.
 */
export function NotificationOpenTracker() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef<string | null>(null);
  const from = params.get("from");

  useEffect(() => {
    if (from !== "morning" && from !== "weekly") return;
    const key = `${pathname}?${params.toString()}`;
    if (handled.current === key) return;
    handled.current = key;
    recordProductEvent({
      type: "NOTIFICATION_OPENED",
      notificationType: FROM_NOTIFICATION[from],
    });
    const rest = new URLSearchParams(params.toString());
    rest.delete("from");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [from, params, pathname, router]);

  return null;
}
