import type { AuthSession } from "../types/auth";
import { getPlayerSession } from "./get-player-session";

/**
 * The session or nothing, for pages that only need to know whether someone
 * is signed in (dashboard, auth pages). Same single read per request as the
 * player tabs (budget: one session read per request,
 * docs/refonte-ui/16-performance-et-qualite.md): an outage reads as no
 * session here, where the player layout shows maintenance instead.
 */
export async function getCurrentSession(): Promise<AuthSession | null> {
  const result = await getPlayerSession();
  return result.status === "signed-in" ? result.session : null;
}
