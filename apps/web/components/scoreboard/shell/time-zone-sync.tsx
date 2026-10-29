"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatTime, isValidTimeZone } from "@/helpers/scoreboard-format";

/**
 * Dépose le fuseau de l'appareil dans un cookie, pour que le serveur écrive
 * les heures comme le téléphone les lit. Si l'écran déjà rendu l'a été dans
 * un autre décalage horaire (première visite hors Abidjan), il est redemandé
 * une fois ; sinon rien ne se passe.
 */
export function TimeZoneSync({
  cookieName,
  serverTimeZone,
}: {
  cookieName: string;
  serverTimeZone: string;
}) {
  const router = useRouter();

  useEffect(() => {
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(device) || device === serverTimeZone) return;
    document.cookie = `${cookieName}=${encodeURIComponent(device)}; path=/; max-age=31536000; samesite=lax`;
    const now = new Date();
    if (
      formatTime(now, "fr", device) !== formatTime(now, "fr", serverTimeZone)
    ) {
      router.refresh();
    }
  }, [cookieName, router, serverTimeZone]);

  return null;
}
