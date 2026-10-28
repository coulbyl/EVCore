"use client";

import type { ReactNode } from "react";
import { Page, PageContent } from "@evcore/ui";
import { useActivePause } from "@/domains/auth/use-cases/use-active-pause";
import { PausedNotice } from "./paused-notice";

/**
 * Remplace une page qui propose des paris par l'annonce de la pause. Les
 * enfants ne sont pas montés : leurs requêtes, refusées par le serveur
 * (403 ACCOUNT_PAUSED), ne partent pas.
 */
export function PauseGate({ children }: { children: ReactNode }) {
  const until = useActivePause();
  if (!until) return children;
  return <PausedPage until={until} />;
}

export function PausedPage({ until }: { until: string }) {
  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <PausedNotice until={until} />
      </PageContent>
    </Page>
  );
}
