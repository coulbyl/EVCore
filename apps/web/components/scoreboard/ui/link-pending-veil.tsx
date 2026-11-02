"use client";

import { useLinkStatus } from "next/link";

/**
 * Un voile discret sur le lien touché tant que sa page n'est pas arrivée
 * (`useLinkStatus`) : le toucher se voit même sur un réseau lent. Posé dans
 * un `<Link>` en `relative`, par-dessus, sans prendre de place.
 */
export function LinkPendingVeil() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] bg-current opacity-10 motion-safe:animate-pulse"
    />
  );
}
