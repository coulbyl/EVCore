"use client";

import { useLinkStatus } from "next/link";
import { clsx as cn } from "clsx";
import { TabLed } from "./tab-led";

/**
 * La diode d'un onglet, toujours rendue pour que rien ne bouge : allumée sur
 * l'onglet actif, elle s'allume aussi en pulsant sur l'onglet touché tant
 * que son écran n'est pas arrivé (`useLinkStatus` ; les onglets n'ont pas de
 * `loading.tsx`, C0b de la refonte). À placer dans le `<Link>` de l'onglet.
 */
export function TabStatusLed({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  const { pending } = useLinkStatus();
  return (
    <TabLed
      className={cn(
        className,
        "transition-opacity",
        active || pending ? "opacity-100" : "opacity-0",
        pending && "motion-safe:animate-pulse",
      )}
    />
  );
}
