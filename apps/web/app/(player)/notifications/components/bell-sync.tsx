"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBell } from "@/domains/notifications/bell-count";

/**
 * The badge counts the same set as the list (no markup). The list is drawn
 * with the page, the badge with the layout, which a navigation does not
 * draw again: a notification written since the layout was drawn (no push,
 * the tab never left) shows in the list and not on the bell. Then the
 * screen is drawn again, layout included, and both read the same count.
 */
export function BellSync({ count }: { count: number }) {
  const router = useRouter();
  const { drawn } = useBell();
  useEffect(() => {
    if (drawn !== null && drawn !== count) router.refresh();
  }, [drawn, count, router]);
  return null;
}
