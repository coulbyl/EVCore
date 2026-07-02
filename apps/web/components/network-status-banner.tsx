"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const OFFLINE_TOAST_ID = "network-offline";
const SLOW_CONNECTION_TOAST_ID = "network-slow-connection";

type NetworkInformationLike = {
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

function readConnection() {
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };

  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function isSlowConnection(connection: NetworkInformationLike | null) {
  if (!connection) return false;
  if (connection.saveData) return true;
  if (
    connection.effectiveType === "slow-2g" ||
    connection.effectiveType === "2g"
  ) {
    return true;
  }
  return typeof connection.rtt === "number" && connection.rtt >= 600;
}

// Network status is reported via sonner toasts rather than a persistent
// banner — this component renders nothing itself. Offline/slow-connection
// toasts use duration: Infinity so they stay up until the condition clears
// or the user dismisses them (Toaster has closeButton enabled globally);
// the reconnect confirmation is a normal transient toast.
export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const syncStatus = () => {
      const online = navigator.onLine;
      const connection = readConnection();
      const slow = online ? isSlowConnection(connection) : false;

      if (online && wasOfflineRef.current) {
        toast.success("Connexion rétablie", {
          description:
            "EVCore peut à nouveau synchroniser les données en direct.",
        });
      }

      wasOfflineRef.current = !online;
      setIsOnline(online);
      setIsSlow(slow);
    };

    syncStatus();

    const connection = readConnection();
    window.addEventListener("online", syncStatus);
    window.addEventListener("offline", syncStatus);
    connection?.addEventListener?.("change", syncStatus);

    return () => {
      window.removeEventListener("online", syncStatus);
      window.removeEventListener("offline", syncStatus);
      connection?.removeEventListener?.("change", syncStatus);
    };
  }, []);

  useEffect(() => {
    if (!isOnline) {
      toast.error("Vous êtes hors ligne", {
        id: OFFLINE_TOAST_ID,
        description:
          "Certaines données EVCore peuvent être indisponibles jusqu'au retour de la connexion.",
        duration: Infinity,
      });
    } else {
      toast.dismiss(OFFLINE_TOAST_ID);
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && isSlow) {
      toast.warning("Connexion lente détectée", {
        id: SLOW_CONNECTION_TOAST_ID,
        description:
          "Les chargements et mises à jour peuvent prendre un peu plus de temps.",
        duration: Infinity,
      });
    } else {
      toast.dismiss(SLOW_CONNECTION_TOAST_ID);
    }
  }, [isOnline, isSlow]);

  return null;
}
