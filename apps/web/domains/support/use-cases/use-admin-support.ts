"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { getSupportSocket } from "@/lib/socket/support-socket";
import type {
  SupportConversation,
  SupportConversationSummary,
  SupportMessage,
} from "../types/support";

const CONVERSATIONS_KEY = ["support", "admin", "conversations"];
const UNREAD_COUNT_KEY = ["support", "admin", "unread-count"];
const messagesKey = (conversationId: string) => [
  "support",
  "admin",
  "messages",
  conversationId,
];

// The admin socket connection is joined to a room that echoes every message
// it sends itself (see use-support-chat.ts for the same race on the operator
// side) — append only if not already present, whichever path wins.
function appendMessageOnce(
  prev: SupportMessage[] | undefined,
  message: SupportMessage,
): SupportMessage[] {
  if (!prev) return [message];
  if (prev.some((m) => m.id === message.id)) return prev;
  return [...prev, message];
}

export function useAdminConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () =>
      clientApiRequest<SupportConversationSummary[]>(
        "/admin/support/conversations",
        { fallbackErrorMessage: "Impossible de charger les conversations." },
      ),
    refetchInterval: 30_000,
  });
}

// Admin-initiated contact — starts (or resumes, it's idempotent) a
// conversation with a chosen user without waiting for them to write first.
export function useStartAdminConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      clientApiRequest<SupportConversation>("/admin/support/conversations", {
        method: "POST",
        body: { userId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });
}

export function useAdminConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: conversationId
      ? messagesKey(conversationId)
      : ["support", "admin", "messages", "none"],
    queryFn: () =>
      clientApiRequest<SupportMessage[]>(
        `/admin/support/conversations/${conversationId}/messages`,
        { fallbackErrorMessage: "Impossible de charger les messages." },
      ),
    enabled: conversationId !== null,
  });
}

export function useSendAdminMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      clientApiRequest<SupportMessage>(
        `/admin/support/conversations/${conversationId}/messages`,
        { method: "POST", body: { content } },
      ),
    onSuccess: (message) => {
      qc.setQueryData<SupportMessage[]>(messagesKey(conversationId), (prev) =>
        appendMessageOnce(prev, message),
      );
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });
}

export function useMarkAdminRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<{ ok: true }>(
        `/admin/support/conversations/${conversationId}/read`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

// Powers the Inbox nav badge for admins (mounted globally in AppShell).
export function useAdminUnreadSupportCount(enabled = true) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const socket = getSupportSocket();
    function handleMessage() {
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    }
    socket.on("message", handleMessage);
    return () => {
      socket.off("message", handleMessage);
    };
  }, [enabled, qc]);

  return useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () =>
      clientApiRequest<{ count: number }>("/admin/support/unread-count", {
        fallbackErrorMessage: "Impossible de récupérer le compteur.",
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled,
  });
}

// Live updates for the whole inbox — patches the open thread (if any) and
// always refreshes the conversation list so unread badges/previews stay current.
export function useAdminSupportSocket(openConversationId: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    const socket = getSupportSocket();

    function handleMessage(message: SupportMessage) {
      if (message.conversationId === openConversationId) {
        qc.setQueryData<SupportMessage[]>(
          messagesKey(message.conversationId),
          (prev) => appendMessageOnce(prev, message),
        );
      }
      qc.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    }

    socket.on("message", handleMessage);
    return () => {
      socket.off("message", handleMessage);
    };
  }, [openConversationId, qc]);
}
