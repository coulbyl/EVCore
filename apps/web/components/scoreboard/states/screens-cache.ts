/**
 * The service worker keeps the last screen of each tab for offline use
 * (public/sw.js). Leaving the account — signing out, a new password, a
 * deletion — empties it: a shared phone keeps nothing of the player.
 */
export async function clearScreensCache(): Promise<void> {
  try {
    if ("caches" in window) await caches.delete("evcore-screens");
  } catch {
    // Storage blocked: nothing was kept either.
  }
}
