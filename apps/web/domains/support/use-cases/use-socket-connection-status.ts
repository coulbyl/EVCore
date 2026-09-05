"use client";

import { useEffect, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { getSupportSocket } from "@/lib/socket/support-socket";

/**
 * Tracks whether the shared support socket is currently connected, and
 * invalidates the given query keys on every (re)connect — a dropped
 * connection can mean missed "message"/"typing" events, so the first thing
 * a fresh connection should do is make sure the visible state isn't stale.
 */
export function useSocketConnectionStatus(
  qc: QueryClient,
  queryKeysToRefresh: unknown[][],
): boolean {
  const [isConnected, setIsConnected] = useState(
    () => getSupportSocket().connected,
  );

  useEffect(() => {
    const socket = getSupportSocket();

    function handleConnect() {
      setIsConnected(true);
      for (const queryKey of queryKeysToRefresh) {
        void qc.invalidateQueries({ queryKey });
      }
    }
    function handleDisconnect() {
      setIsConnected(false);
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    // The socket may already be connected by the time this effect runs
    // (shared singleton, likely opened by another hook first) — sync once.
    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [qc, queryKeysToRefresh]);

  return isConnected;
}
