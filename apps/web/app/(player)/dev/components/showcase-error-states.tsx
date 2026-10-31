"use client";

import { ErrorState } from "@/components/scoreboard/states/error-state";

const SERVER_ERROR = new Error("hidden server detail");
const STALE_VERSION = Object.assign(new Error("Loading chunk 482 failed."), {
  name: "ChunkLoadError",
});

/**
 * Les deux visages de l'erreur d'écran (le hors-ligne se voit en coupant le
 * réseau dans les outils du navigateur). Réessayer ne fait rien ici.
 */
export function ShowcaseErrorStates() {
  const noop = () => undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-[0.875rem] border border-border">
        <ErrorState error={SERVER_ERROR} retry={noop} />
      </div>
      <div className="overflow-hidden rounded-[0.875rem] border border-border">
        <ErrorState error={STALE_VERSION} retry={noop} />
      </div>
    </div>
  );
}
