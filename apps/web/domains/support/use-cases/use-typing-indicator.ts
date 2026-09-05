"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupportSocket } from "@/lib/socket/support-socket";
import type { TypingEvent } from "../types/support";

// Idle time after the last keystroke before we tell the other side we
// stopped — the actual traffic-saver: one "typing:true" per burst, one
// "typing:false" when the burst goes quiet, never one event per character.
const TYPING_STOP_DEBOUNCE_MS = 2_500;

// Receiver-side safety net: if the sender's "stopped" never arrives (closed
// tab racing the disconnect handler, dropped packet), the indicator clears
// itself instead of sticking forever.
const TYPING_RECEIVE_TIMEOUT_MS = 6_000;

/**
 * Send side of the typing indicator. Call `notify()` on every keystroke —
 * it only actually emits on the first keystroke of a burst and once more
 * when the burst goes idle, everything in between is a local timer reset.
 * Call `stop()` immediately on send (no point telling the other side
 * "still typing" about a message that just went out).
 */
export function useTypingSender(conversationId: string | undefined) {
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const isTypingRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitStop = useCallback((forConversationId: string) => {
    isTypingRef.current = false;
    getSupportSocket().emit("typing", {
      conversationId: forConversationId,
      isTyping: false,
    });
  }, []);

  const notify = useCallback(() => {
    const id = conversationIdRef.current;
    if (!id) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      getSupportSocket().emit("typing", { conversationId: id, isTyping: true });
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) emitStop(id);
    }, TYPING_STOP_DEBOUNCE_MS);
  }, [emitStop]);

  const stop = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    const id = conversationIdRef.current;
    if (isTypingRef.current && id) emitStop(id);
  }, [emitStop]);

  // Runs on unmount and whenever conversationId changes — closes over the
  // conversation this render belonged to, so switching threads mid-burst
  // clears the indicator on the thread being left, not the new one.
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (isTypingRef.current && conversationId) emitStop(conversationId);
    };
  }, [conversationId, emitStop]);

  return { notify, stop };
}

export type TypingState = Map<
  string,
  { username: string; role: "ADMIN" | "OPERATOR" }
>;

/**
 * Receive side — a live map of conversationId → who's typing there. Works
 * for both inboxes: the operator's map only ever has one possible key (their
 * own conversation), the admin's can have several (one per open thread).
 */
export function useTypingReceiver(): TypingState {
  const [state, setState] = useState<TypingState>(new Map());
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const socket = getSupportSocket();
    const timers = timersRef.current;

    function clear(conversationId: string) {
      const timer = timers.get(conversationId);
      if (timer) clearTimeout(timer);
      timers.delete(conversationId);
      setState((prev) => {
        if (!prev.has(conversationId)) return prev;
        const next = new Map(prev);
        next.delete(conversationId);
        return next;
      });
    }

    function handleTyping(event: TypingEvent) {
      const existingTimer = timers.get(event.conversationId);
      if (existingTimer) clearTimeout(existingTimer);

      if (!event.isTyping) {
        clear(event.conversationId);
        return;
      }

      setState((prev) => {
        const next = new Map(prev);
        next.set(event.conversationId, {
          username: event.username,
          role: event.role,
        });
        return next;
      });
      timers.set(
        event.conversationId,
        setTimeout(
          () => clear(event.conversationId),
          TYPING_RECEIVE_TIMEOUT_MS,
        ),
      );
    }

    socket.on("typing", handleTyping);
    return () => {
      socket.off("typing", handleTyping);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  return state;
}
