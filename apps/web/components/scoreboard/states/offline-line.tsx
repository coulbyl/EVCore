"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WifiOff } from "lucide-react";
import { useOnline } from "./use-online";

/**
 * « Hors ligne · vu à 18:42 » en haut du contenu (10-transverse.md § 2) :
 * l'écran reste lisible, avec l'heure à laquelle il a été chargé. Rien ne
 * s'affiche tant que le réseau est là.
 */
export function OfflineLine() {
  const online = useOnline();
  const pathname = usePathname();
  const t = useTranslations("scoreboard.states");
  const [seenAt, setSeenAt] = useState<Date | null>(null);

  // L'heure du dernier écran chargé avec du réseau.
  useEffect(() => {
    if (online) setSeenAt(new Date());
  }, [online, pathname]);

  if (online) return null;

  const time = seenAt
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(seenAt)
    : null;

  return (
    <div
      role="status"
      className="sticky top-0 z-30 flex min-h-11 items-center gap-2 bg-secondary px-4 text-body font-medium text-secondary-foreground pt-[env(safe-area-inset-top)] lg:px-6"
    >
      <WifiOff aria-hidden className="size-4 shrink-0" strokeWidth={2} />
      {time ? t("offlineSeenAt", { time }) : t("offline")}
    </div>
  );
}
