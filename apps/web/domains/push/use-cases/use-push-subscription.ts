"use client";

import { useCallback, useEffect, useState } from "react";
import { clientApiRequest } from "@/lib/api/client-api";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push/subscribe";

export type PushSubscriptionStatus =
  | "unsupported"
  | "default"
  | "denied"
  | "subscribed"
  | "available"; // permission granted, but not subscribed on this device yet

async function fetchVapidPublicKey(): Promise<string | null> {
  const { publicKey } = await clientApiRequest<{ publicKey: string | null }>(
    "/push/vapid-public-key",
  );
  return publicKey;
}

// Drives the "Activer les notifications" toggle — resolves current
// permission/subscription state on mount, and posts/deletes the
// subscription against the backend so PushService knows where to deliver.
export function usePushSubscription() {
  const [status, setStatus] = useState<PushSubscriptionStatus>("default");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isPushSupported()) {
      setStatus("unsupported");
      return;
    }
    const permission = getNotificationPermission();
    if (permission === "denied") {
      setStatus("denied");
      return;
    }
    const existing = await getExistingSubscription();
    setStatus(existing ? "subscribed" : "available");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const publicKey = await fetchVapidPublicKey();
      if (!publicKey) {
        throw new Error("Notifications push non configurées côté serveur.");
      }
      const subscription = await subscribeToPush(publicKey);
      const json = subscription.toJSON();
      await clientApiRequest("/push/subscribe", {
        method: "POST",
        body: {
          endpoint: json.endpoint,
          keys: json.keys,
          userAgent: navigator.userAgent,
        },
      });
      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      await refresh();
    } finally {
      setIsBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const subscription = await getExistingSubscription();
      if (subscription) {
        await clientApiRequest("/push/subscribe", {
          method: "DELETE",
          body: { endpoint: subscription.endpoint },
        });
        await unsubscribeFromPush(subscription);
      }
      setStatus("available");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { status, isBusy, error, enable, disable };
}
