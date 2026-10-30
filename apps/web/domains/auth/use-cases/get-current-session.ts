import { cache } from "react";
import type { AuthSession } from "../types/auth";
import { serverApiRequest } from "@/lib/api/server-api";

async function readCurrentSession(): Promise<AuthSession | null> {
  try {
    const payload = await serverApiRequest<{ session: AuthSession }>(
      "/auth/me",
    );
    return payload.session;
  } catch {
    return null;
  }
}

/**
 * The session of the dashboard, read once per request: the layout, the
 * admin-only layouts and the pages share the same answer (budget: one
 * session read per request, docs/refonte-ui/16-performance-et-qualite.md).
 */
export const getCurrentSession = cache(readCurrentSession);
