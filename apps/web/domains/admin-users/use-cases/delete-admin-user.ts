"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export async function deleteAdminUser(userId: string): Promise<void> {
  await clientApiRequest<void>(`/admin/users/${userId}`, {
    method: "DELETE",
    fallbackErrorMessage: "Impossible de supprimer cet utilisateur.",
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
