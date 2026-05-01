"use client";

import { useEffect } from "react";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  useFormationProgress,
  type RemoteFormationProgressItem,
} from "@/domains/formation/use-cases/use-formation-progress";

let didSync = false;

export function FormationProgressSync() {
  const { hydrateRemote } = useFormationProgress();

  useEffect(() => {
    if (didSync) return;
    didSync = true;

    void clientApiRequest<RemoteFormationProgressItem[]>(
      "/formation/progress",
      { fallbackErrorMessage: "" },
    )
      .then((items) => hydrateRemote(items))
      .catch(() => {
        // Ignore when unauthenticated or backend not available.
      });
  }, [hydrateRemote]);

  return null;
}
