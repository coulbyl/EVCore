import { io, type Socket } from "socket.io-client";
import { BACKEND_URL } from "@/lib/api/shared";

let socket: Socket | null = null;

// Single shared connection for the whole tab — the support widget (operator)
// and the admin inbox never mount at the same time for a given session, so
// one lazily-created socket is enough.
export function getSupportSocket(): Socket {
  if (socket) return socket;
  socket = io(`${BACKEND_URL}/support`, {
    withCredentials: true,
    autoConnect: true,
  });
  return socket;
}
