"use client";

import { cn } from "@evcore/ui";
import { useTranslations } from "next-intl";

/** Minimum de cote accepté par les books des utilisateurs (1xBet). */
const OPERATOR_MIN_ODDS = 1.1;

/**
 * La cote que l'utilisateur trouvera chez son bookmaker, à côté de la nôtre.
 * Notre prix de référence vient des books les plus généreux du relevé ; sur
 * les cotes courtes, 1xBet est 2 à 5 % en dessous, et un 1,14 affiché
 * devenait 1,07 au guichet, sous le minimum de 1,10 (revue du 2026-10-18).
 * Rien tant que la cote jouable est inconnue ou égale à la nôtre ; en rouge
 * quand elle passe sous le minimum.
 */
export function PlayableOdds({
  odds,
  playableOdds,
  playableBookmaker,
}: {
  odds: number | null;
  playableOdds: number | null;
  playableBookmaker: string | null;
}) {
  const t = useTranslations("playableOdds");
  if (playableOdds === null || playableBookmaker === null) return null;
  if (odds !== null && Math.abs(playableOdds - odds) < 0.005) return null;
  const belowMinimum = playableOdds < OPERATOR_MIN_ODDS;
  return (
    <span
      data-testid="playable-odds"
      data-below-minimum={belowMinimum ? "true" : undefined}
      title={
        belowMinimum
          ? t("belowMinimum", { min: OPERATOR_MIN_ODDS.toFixed(2) })
          : t("hint")
      }
      className={cn(
        "tabular-nums",
        belowMinimum
          ? "font-semibold text-destructive"
          : "text-muted-foreground",
      )}
    >
      {t("label", {
        bookmaker: playableBookmaker,
        odds: playableOdds.toFixed(2),
      })}
    </span>
  );
}
