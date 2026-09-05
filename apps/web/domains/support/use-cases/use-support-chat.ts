"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";
import { getSupportSocket } from "@/lib/socket/support-socket";
import type { OwnConversationResponse, SupportMessage } from "../types/support";
import { useMessageComposer } from "./use-message-composer";
import { useSocketConnectionStatus } from "./use-socket-connection-status";
import { useTypingReceiver, useTypingSender } from "./use-typing-indicator";

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

// Optimistic send: the message shows up immediately with a "sending" state,
// flips to a retryable "failed" bubble on error (content preserved), and
// disappears once the confirmed message lands in the cache — via this same
// success handler, or the socket echo in useSupportSocket, whichever wins.
export function useSupportComposer() {
  const qc = useQueryClient();
  return useMessageComposer({
    senderRole: "OPERATOR",
    sendFn: (content) =>
      clientApiRequest<SupportMessage>("/support/messages", {
        method: "POST",
        body: { content },
      }),
    onSent: (message) => {
      qc.setQueryData<OwnConversationResponse>(QUERY_KEY, (prev) =>
        appendMessageOnce(prev, message),
      );
    },
  });
}

// Send side: call notifyTyping() on every keystroke (self-debounced), and
// stopTyping() right when a message actually goes out. Receive side: a
// label for "the team is typing", derived from the same generic map used by
// the admin inbox (which tracks per-conversation, this only ever has one).
export function useSupportTyping(conversationId: string | undefined) {
  const { notify, stop } = useTypingSender(conversationId);
  const typingState = useTypingReceiver();
  const typingLabel =
    conversationId && typingState.has(conversationId)
      ? "L'équipe EVCore est en train d'écrire…"
      : null;
  return { notifyTyping: notify, stopTyping: stop, typingLabel };
}

// Powers the "connexion perdue" banner and refreshes the conversation as
// soon as the socket reconnects — a drop could mean a missed message.
export function useSupportConnectionStatus(): boolean {
  const qc = useQueryClient();
  return useSocketConnectionStatus(qc, [QUERY_KEY]);
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
