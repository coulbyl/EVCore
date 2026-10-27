"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTrackRecordSummary } from "@/domains/dashboard/use-cases/get-track-record-summary";
import {
  dateRangeForPeriod,
  formatOddsBand,
} from "@/app/dashboard/track-record/track-record-constants";

/**
 * Sous un pronostic, ce que les pourcentages ont donné à sa cote sur 90
 * jours — seulement quand ils ont été optimistes. Remplace le badge
 * « Fiable », calculé par canal et par championnat : affiché sur 52 matchs
 * sur 54, il ne disait plus rien, et la fiabilité d'un canal dans un
 * championnat ne se maintient pas d'une période à l'autre (audit du
 * 2026-10-23, P2-12 ; corrélation 0,06 entre périodes). Silence quand la
 * tranche est conforme : c'est le cas normal, pas une information.
 */
export function OddsBandNote({ odds }: { odds: number | null }) {
  const t = useTranslations("oddsBandNote");
  const locale = useLocale();
  const range = dateRangeForPeriod("90");
  const { data } = useTrackRecordSummary(range.from, range.to);
  if (odds === null || !data) return null;
  const band = data.byOdds.find(
    (b) =>
      (b.minOdds === null || odds >= b.minOdds) &&
      (b.maxOdds === null || odds < b.maxOdds),
  );
  if (
    !band ||
    !band.sufficient ||
    band.announced === null ||
    band.realised === null ||
    band.realised >= band.announced ||
    (band.status !== "ORANGE" && band.status !== "RED")
  ) {
    return null;
  }
  return (
    <span data-testid="odds-band-note" className="text-warning">
      {t("optimistic", {
        band: formatOddsBand(band, locale),
        announced: Math.round(band.announced * 100),
        realised: Math.round(band.realised * 100),
      })}
    </span>
  );
}
