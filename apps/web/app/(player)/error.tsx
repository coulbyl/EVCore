"use client";

import { ErrorState } from "@/components/scoreboard/states/error-state";

/**
 * Un écran du joueur qui n'a pas pu se rendre : une ligne et une issue, la
 * coquille et les onglets restent en place (10-transverse.md § 2).
 */
export default function PlayerError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <ErrorState error={error} retry={unstable_retry} />;
}
