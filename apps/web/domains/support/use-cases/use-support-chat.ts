"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { getSupportSocket } from "@/lib/socket/support-socket";
import type { OwnConversationResponse, SupportMessage } from "../types/support";

const QUERY_KEY = ["support", "own-conversation"];
const UNREAD_COUNT_KEY = ["support", "unread-count"];

// The sender is joined to their own conversation room, so a message they just
// posted via HTTP also arrives back over the socket as an echo — append only
// if it isn't already in the cache, regardless of which path wins the race.
function appendMessageOnce(
  prev: OwnConversationResponse | undefined,
  message: SupportMessage,
): OwnConversationResponse | undefined {
  if (!prev) return prev;
  if (prev.messages.some((m) => m.id === message.id)) return prev;
  return { ...prev, messages: [...prev.messages, message] };
}

export function useOwnConversation() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () =>
      clientApiRequest<OwnConversationResponse>("/support/conversation", {
        fallbackErrorMessage: "Impossible de charger la conversation.",
      }),
    staleTime: 30_000,
  });
}

export function useSendSupportMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      clientApiRequest<SupportMessage>("/support/messages", {
        method: "POST",
        body: { content },
      }),
    onSuccess: (message) => {
      qc.setQueryData<OwnConversationResponse>(QUERY_KEY, (prev) =>
        appendMessageOnce(prev, message),
      );
    },
  });
}

export function useMarkSupportRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      clientApiRequest<{ ok: true }>("/support/read", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY }),
  });
}

// Powers the Inbox nav badge (mounted globally in AppShell, not just on the
// inbox page) — polls like the notification bell, and also invalidates as
// soon as a message arrives over the shared socket so the badge doesn't wait
// a full minute to appear.
export function useUnreadSupportCount(enabled = true) {
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
      clientApiRequest<{ count: number }>("/support/unread-count", {
        fallbackErrorMessage: "Impossible de récupérer le compteur.",
      }),
    refetchInterval: 60_000,
    staleTime: 30_000,
    enabled,
  });
}

// Live updates — appends messages pushed by the team while the widget is
// mounted, without waiting for the next poll/refetch.
export function useSupportSocket(conversationId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;
    const socket = getSupportSocket();

    function handleMessage(message: SupportMessage) {
      if (message.conversationId !== conversationId) return;
      qc.setQueryData<OwnConversationResponse>(QUERY_KEY, (prev) =>
        appendMessageOnce(prev, message),
      );
    }

    socket.on("message", handleMessage);
    return () => {
      socket.off("message", handleMessage);
    };
  }, [conversationId, qc]);
}
