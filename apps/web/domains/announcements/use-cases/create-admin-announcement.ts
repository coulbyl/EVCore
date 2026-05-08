"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  CreateAnnouncementInput,
  Announcement,
} from "../types/announcements";

export async function createAdminAnnouncement(
  input: CreateAnnouncementInput,
): Promise<Announcement> {
  return clientApiRequest<Announcement>("/admin/announcements", {
    method: "POST",
    body: input,
    fallbackErrorMessage: "Impossible de créer cette annonce.",
  });
}

export function useCreateAdminAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAdminAnnouncement,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-announcements"] }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard-announcements"],
        }),
      ]);
    },
  });
}
