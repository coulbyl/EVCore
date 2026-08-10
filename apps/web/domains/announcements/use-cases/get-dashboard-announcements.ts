"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { UserAnnouncement } from "../types/announcements";

export async function getDashboardAnnouncements(): Promise<
  UserAnnouncement[]
> {
  return clientApiRequest<UserAnnouncement[]>("/dashboard/announcements", {
    fallbackErrorMessage: "Impossible de charger les annonces.",
  });
}

export function useDashboardAnnouncements() {
  return useQuery({
    queryKey: ["dashboard-announcements"],
    queryFn: getDashboardAnnouncements,
  });
}
