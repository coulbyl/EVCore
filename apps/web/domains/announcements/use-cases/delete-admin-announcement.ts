"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function deleteAdminAnnouncement(id: string): Promise<void> {
  return clientApiRequest<void>(`/admin/announcements/${id}`, {
    method: "DELETE",
    fallbackErrorMessage: "Impossible de supprimer cette annonce.",
  });
}

export function useDeleteAdminAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminAnnouncement,
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
