"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { Announcement } from "../types/announcements";

export async function getAdminAnnouncements(): Promise<Announcement[]> {
  return clientApiRequest<Announcement[]>("/admin/announcements", {
    fallbackErrorMessage: "Impossible de charger les annonces admin.",
  });
}

export function useAdminAnnouncements() {
  return useQuery({
    queryKey: ["admin-announcements"],
    queryFn: getAdminAnnouncements,
  });
}
