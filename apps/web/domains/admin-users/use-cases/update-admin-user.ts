"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { AdminUserRow, AdminUserRole } from "../types/admin-users";

export type UpdateAdminUserInput = {
  userId: string;
  role?: AdminUserRole;
  emailVerified?: boolean;
};

export async function updateAdminUser(
  input: UpdateAdminUserInput,
): Promise<AdminUserRow> {
  const { userId, ...body } = input;
  return clientApiRequest<AdminUserRow>(`/admin/users/${userId}`, {
    method: "PATCH",
    body,
    fallbackErrorMessage: "Impossible de mettre à jour cet utilisateur.",
  });
}

export function useUpdateAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAdminUser,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });
}
