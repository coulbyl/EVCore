import { ScreenSkeleton } from "@/components/scoreboard/states/screen-skeleton";

/**
 * Pendant qu'un onglet se charge : la forme grise de l'écran, préchargée par
 * Next avec le lien, pour une navigation immédiate (10-transverse.md § 2).
 */
export default function Loading() {
  return <ScreenSkeleton />;
}
