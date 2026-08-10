"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function markAnnouncementRead(id: string): Promise<void> {
  await clientApiRequest<{ status: "ok" }>(
    `/dashboard/announcements/${id}/read`,
    {
      method: "POST",
      fallbackErrorMessage: "Impossible de marquer cette annonce comme lue.",
    },
  );
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["dashboard-announcements"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboard-announcements-unread-count"],
        }),
      ]);
    },
  });
}
