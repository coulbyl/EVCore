"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function getAnnouncementsUnreadCount(): Promise<number> {
  const { count } = await clientApiRequest<{ count: number }>(
    "/dashboard/announcements/unread-count",
    { fallbackErrorMessage: "Impossible de charger les annonces non lues." },
  );
  return count;
}

export function useAnnouncementsUnreadCount() {
  return useQuery({
    queryKey: ["dashboard-announcements-unread-count"],
    queryFn: getAnnouncementsUnreadCount,
  });
}
