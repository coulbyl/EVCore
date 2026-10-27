"use client";

import { Button, Page, PageContent } from "@evcore/ui";

/** Dernier filet : chaque bloc a déjà son repli dans page.tsx, cette page ne
 * s'affiche que si le rendu lui-même échoue. */
export default function TrackRecordError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="flex flex-1 flex-col items-start gap-3 p-4 sm:p-5 ev-shell-shadow">
        <h1 className="text-lg font-semibold text-foreground">
          Les mesures n&apos;ont pas chargé
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Vérifie ta connexion, puis réessaie. Les chiffres ne sont pas perdus.
        </p>
        <Button onClick={reset}>Réessayer</Button>
      </PageContent>
    </Page>
  );
}
