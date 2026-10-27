"use client";

import { cn } from "@evcore/ui";
import { useTranslations } from "next-intl";
import type { ChannelSelectionDto } from "@/domains/channel-decision/types/channel-decision";
import { formatOddsValue } from "@/lib/frequency";

/** Minimum de cote accepté par le bookmaker des joueurs (1xBet). */
const OPERATOR_MIN_ODDS = 1.1;

/**
 * La cote que le joueur trouvera chez son bookmaker d'abord, la nôtre (books
 * les plus généreux du relevé) en référence ; la nôtre seule quand la cote
 * jouable est inconnue ou identique. Sous le minimum de l'opérateur, la cote
 * jouable le dit en clair au lieu d'un rouge sans explication.
 */
export function OddsPair({
  selection,
  locale,
}: {
  selection: ChannelSelectionDto;
  locale: string;
}) {
  const t = useTranslations("decisions");
  const { odds, playableOdds, playableBookmaker } = selection;
  if (odds === null) return null;
  const differs =
    playableOdds !== null &&
    playableBookmaker !== null &&
    Math.abs(playableOdds - odds) >= 0.005;
  if (!differs || playableOdds === null || playableBookmaker === null) {
    return (
      <span className="font-semibold tabular-nums text-foreground">
        {playableBookmaker
          ? t("playableLabel", {
              bookmaker: playableBookmaker,
              odds: formatOddsValue(odds, locale),
            })
          : t("oddsLabel", { odds: formatOddsValue(odds, locale) })}
      </span>
    );
  }
  const belowMinimum = playableOdds < OPERATOR_MIN_ODDS;
  return (
    <>
      <span
        data-testid="playable-odds"
        className={cn(
          "font-semibold tabular-nums",
          belowMinimum ? "text-destructive" : "text-foreground",
        )}
      >
        {t("playableLabel", {
          bookmaker: playableBookmaker,
          odds: formatOddsValue(playableOdds, locale),
        })}
      </span>
      <span className="tabular-nums">
        {t("referenceOdds", { odds: formatOddsValue(odds, locale) })}
      </span>
      {belowMinimum && (
        <span className="text-destructive">
          {t("belowMinimum", {
            bookmaker: playableBookmaker,
            min: formatOddsValue(OPERATOR_MIN_ODDS, locale),
          })}
        </span>
      )}
    </>
  );
}
