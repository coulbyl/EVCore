"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@evcore/ui";
import { CloudAlert, Wifi, WifiOff } from "lucide-react";

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
  if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
    return true;
  }
  return typeof connection.rtt === "number" && connection.rtt >= 600;
}

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const [showReconnectToast, setShowReconnectToast] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const syncStatus = () => {
      const online = navigator.onLine;
      const connection = readConnection();
      const slow = online ? isSlowConnection(connection) : false;

      if (online && wasOfflineRef.current) {
        setShowReconnectToast(true);
        window.setTimeout(() => setShowReconnectToast(false), 3200);
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

  const banner = useMemo(() => {
    if (!isOnline) {
      return {
        icon: <WifiOff className="size-4" />,
        title: "Vous êtes hors ligne",
        description:
          "Certaines données EVCore peuvent être indisponibles jusqu'au retour de la connexion.",
        className:
          "border-danger/30 bg-danger/8 text-danger [&_[data-slot=alert-description]]:text-danger/85",
      };
    }

    if (isSlow) {
      return {
        icon: <CloudAlert className="size-4" />,
        title: "Connexion lente détectée",
        description:
          "Les chargements et mises à jour peuvent prendre un peu plus de temps.",
        className:
          "border-warning/30 bg-warning/8 text-warning [&_[data-slot=alert-description]]:text-warning/85",
      };
    }

    return null;
  }, [isOnline, isSlow]);

  return (
    <>
      {banner ? (
        <div className="px-4 pb-3 lg:px-5">
          <Alert className={banner.className}>
            {banner.icon}
            <AlertTitle>{banner.title}</AlertTitle>
            <AlertDescription>{banner.description}</AlertDescription>
          </Alert>
        </div>
      ) : null}

      {showReconnectToast ? (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 w-[calc(100%-2rem)] max-w-sm sm:bottom-4">
          <Alert className="border-success/30 bg-success/10 text-success [&_[data-slot=alert-description]]:text-success/85">
            <Wifi className="size-4" />
            <AlertTitle>Connexion rétablie</AlertTitle>
            <AlertDescription>
              EVCore peut à nouveau synchroniser les données en direct.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
    </>
  );
}
