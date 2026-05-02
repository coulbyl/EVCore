"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import type {
  PaginatedNotifications,
  NotificationView,
} from "../types/notification";

export async function fetchNotifications(params: {
  limit?: number;
  offset?: number;
  unread?: boolean;
}): Promise<PaginatedNotifications> {
  const search = new URLSearchParams();
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));
  if (params.unread !== undefined) search.set("unread", String(params.unread));
  const qs = search.toString();
  return clientApiRequest<PaginatedNotifications>(
    `/notifications${qs ? `?${qs}` : ""}`,
    { fallbackErrorMessage: "Impossible de charger les notifications." },
  );
}

export async function fetchUnreadCount(): Promise<{ count: number }> {
  return clientApiRequest<{ count: number }>("/notifications/unread-count", {
    fallbackErrorMessage: "Impossible de récupérer le compteur.",
  });
}

export function useNotifications(
  params: {
    limit?: number;
    offset?: number;
    unread?: boolean;
  } = {},
) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: () => fetchNotifications(params),
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: fetchUnreadCount,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      clientApiRequest<void>(`/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<void>("/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      void queryClient.invalidateQueries({
        queryKey: ["notifications-unread-count"],
      });
    },
  });
}
