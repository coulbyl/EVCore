"use client";

import { useQuery } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type { AdminUsersListResponse } from "../types/admin-users";

export type AdminUsersQuery = {
  q?: string;
  role?: "ALL" | "ADMIN" | "OPERATOR";
  page?: number;
  pageSize?: number;
};

export async function getAdminUsers(
  query: AdminUsersQuery,
): Promise<AdminUsersListResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.role) params.set("role", query.role);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));

  return clientApiRequest<AdminUsersListResponse>(
    `/admin/users?${params.toString()}`,
    { fallbackErrorMessage: "Impossible de charger les utilisateurs." },
  );
}

export function useAdminUsers(query: AdminUsersQuery) {
  return useQuery({
    queryKey: ["admin-users", query],
    queryFn: () => getAdminUsers(query),
  });
}
