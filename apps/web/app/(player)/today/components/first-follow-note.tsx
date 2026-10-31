"use client";

import { useState } from "react";
import { playerFetch } from "@/lib/api/player-fetch";
import {
  getNotificationPermission,
  subscribeToPush,
} from "@/lib/push/subscribe";

export type FirstFollowLabels = {
  note: string;
  ask: string;
  yes: string;
  later: string;
};

/**
 * The first « Suivre » on this device (04 § 3, 10 § 1): « Tu recevras son
 * résultat demain matin », then the request for push notifications, at
 * that moment and not before — the player just said they want a result.
 * Loaded on demand by the follow button, so neither this nor the push
 * code weighs on Aujourd'hui.
 */
export default function FirstFollowNote({
  labels,
}: {
  labels: FirstFollowLabels;
}) {
  const [asking, setAsking] = useState(
    () => getNotificationPermission() === "default",
  );

  async function subscribe() {
    setAsking(false);
    try {
      const key = await playerFetch<{ publicKey: string | null }>(
        "/push/vapid-public-key",
        { method: "GET" },
      );
      if (!key?.publicKey) return;
      const subscription = (await subscribeToPush(key.publicKey)).toJSON();
      await playerFetch("/push/subscribe", {
        method: "POST",
        body: {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: navigator.userAgent,
        },
      });
    } catch {
      // Refused or unavailable: the morning summary still has the result.
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="text-meta text-muted-foreground">
        {labels.note}
      </p>
      {asking ? (
        <div className="flex flex-col gap-2 rounded-[0.875rem] border border-border bg-card p-3">
          <p className="text-body font-medium">{labels.ask}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={subscribe}
              className="min-h-11 flex-1 rounded-[0.625rem] bg-primary px-3 text-body font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {labels.yes}
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className="min-h-11 flex-1 rounded-[0.625rem] border border-border px-3 text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {labels.later}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
