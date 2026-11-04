"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDocumentVisible } from "@/components/scoreboard/states/use-document-visible";
import {
  confirmDrawnCount,
  confirmedUnread,
  useConfirmedUnread,
} from "@/domains/notifications/use-unread-count";

/**
 * The one rule that redraws the Notifications list (no markup): the list
 * was drawn with the badge's unread count (`count`, the same set); when the
 * confirmed count moves away from it — a row read here or in another tab,
 * a push, a return, « tout marquer » — the list is drawn again, once the
 * tab shows. A fresh render's count is the confirmed count from then on
 * (`render`: a render restored from the router's cache brings nothing
 * back), so the redrawn list settles the rule.
 */
export function UnreadDrawn({
  count,
  render,
}: {
  count: number;
  render: string;
}) {
  const router = useRouter();
  const visible = useDocumentVisible();
  const confirmed = useConfirmedUnread();

  useEffect(() => {
    confirmDrawnCount(count, render);
  }, [count, render]);

  useEffect(() => {
    // Read from the store, not the render: the effect above may have just
    // confirmed this render's count.
    const now = confirmedUnread();
    if (visible && now !== null && now !== count) router.refresh();
  }, [visible, confirmed, count, router]);

  return null;
}
