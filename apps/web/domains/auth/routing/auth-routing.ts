/** The session cookie the backend sets (apps/backend auth.constants.ts). */
export const SESSION_COOKIE = "evcore_session";

/**
 * Set by the proxy on player routes: the address asked for, so the player
 * layout can send a visitor whose session turned out stale back to it after
 * login. Overwritten on every request; never read from the client.
 */
export const REQUESTED_PATH_HEADER = "x-evcore-requested-path";

/** The login address that returns to `path` afterwards. */
export function loginPathFor(path: string | null): string {
  if (!path) return "/auth/login";
  return `/auth/login?next=${encodeURIComponent(path)}`;
}
