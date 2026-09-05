"use client";

import { useCallback, useRef, useState } from "react";
import type { SupportMessage } from "../types/support";

let localIdCounter = 0;

// Prefixed and monotonic rather than crypto.randomUUID() — collision-proof
// enough for a purely local, single-tab-lifetime key, no crypto dependency.
function nextLocalId(): string {
  localIdCounter += 1;
  return `pending:${Date.now()}:${localIdCounter}`;
}

/**
 * Optimistic send for the support chat composer, shared by the operator and
 * admin inboxes: shows the message immediately with a "sending" bubble,
 * flips it to "failed" (content preserved, retryable) if the request
 * rejects, and drops it once the real message lands in the query cache
 * (appended by the caller's onSent, and/or echoed back over the socket).
 *
 * Does not touch the query cache itself — callers own their own cache shape
 * (own-conversation object vs. flat message array) and pass `onSent` to
 * write the confirmed message in.
 */
export function useMessageComposer(options: {
  senderRole: "ADMIN" | "OPERATOR";
  sendFn: (content: string) => Promise<SupportMessage>;
  onSent: (message: SupportMessage) => void;
}) {
  const { senderRole } = options;
  const [pending, setPending] = useState<SupportMessage[]>([]);
  // sendFn/onSent are recreated every render (inline closures at call
  // sites) — a ref keeps retry() and send() from going stale without
  // forcing every caller to useCallback their arguments.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const attempt = useCallback((localId: string, content: string) => {
    setPending((prev) =>
      prev.map((m) => (m.id === localId ? { ...m, status: "sending" } : m)),
    );
    optionsRef.current.sendFn(content).then(
      (message) => {
        setPending((prev) => prev.filter((m) => m.id !== localId));
        optionsRef.current.onSent(message);
      },
      () => {
        setPending((prev) =>
          prev.map((m) => (m.id === localId ? { ...m, status: "failed" } : m)),
        );
      },
    );
  }, []);

  const send = useCallback(
    (content: string) => {
      const localId = nextLocalId();
      const optimistic: SupportMessage = {
        id: localId,
        conversationId: "",
        senderId: "",
        senderRole,
        senderUsername: "",
        content,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      setPending((prev) => [...prev, optimistic]);
      attempt(localId, content);
    },
    [attempt, senderRole],
  );

  const retry = useCallback(
    (localId: string) => {
      const message = pending.find((m) => m.id === localId);
      if (!message) return;
      attempt(localId, message.content);
    },
    [attempt, pending],
  );

  const discard = useCallback((localId: string) => {
    setPending((prev) => prev.filter((m) => m.id !== localId));
  }, []);

  return { pending, send, retry, discard };
}
