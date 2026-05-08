"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  Announcement,
  UpdateAnnouncementInput,
} from "../types/announcements";

export async function updateAdminAnnouncement(
  input: UpdateAnnouncementInput,
): Promise<Announcement> {
  const { id, ...body } = input;
  return clientApiRequest<Announcement>(`/admin/announcements/${id}`, {
    method: "PATCH",
    body,
    fallbackErrorMessage: "Impossible de mettre à jour cette annonce.",
  });
}

export function useUpdateAdminAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminAnnouncement,
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
