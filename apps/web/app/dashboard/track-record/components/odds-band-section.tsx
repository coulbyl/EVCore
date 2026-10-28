import type { TrackRecordOddsBand } from "@/domains/dashboard/types/dashboard";
import {
  formatCount,
  formatOddsBand,
  formatSignedRate,
} from "../track-record-constants";
import { CalibrationVerdict } from "./calibration-verdict";

/**
 * Fréquence du marché et réalisé par tranche de cote (2026-10-28 ; avant :
 * la probabilité du moteur). Le joueur lit les deux chiffres côte à côte,
 * sans verdict ni écart calculé (décision de l'étude Notre sélection : on
 * n'affiche pas d'avantage mesuré) ; l'admin garde la lecture du moteur.
 *
 *
 * La moyenne de l'en-tête mélange des favoris à 80 % et des cotes longues à
 * 30 % : elle ne dit pas au joueur si le pourcentage de son pronostic tient.
 * Le régime change à 1,45 et 1,80 (CLAUDE.md, calibration des jambes), d'où
 * ces trois lignes, lues « sur 100 annoncés à x %, y sont passés » plutôt
 * qu'en ratio (audit UX du 2026-10-27).
 */
export function OddsBandSection({
  bands,
  settledTotal,
  locale,
  audience,
}: {
  bands: TrackRecordOddsBand[];
  /** Total de l'en-tête : la différence n'avait pas de cote relevée. */
  settledTotal: number;
  locale: string;
  audience: "player" | "admin";
}) {
  const withoutOdds =
    settledTotal - bands.reduce((acc, band) => acc + band.settled, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Par cote
      </h2>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-panel">
        {bands.map((band) => {
          const ratio =
            band.announced && band.realised !== null
              ? band.realised / band.announced
              : null;
          return (
            <li
              key={`${band.minOdds}-${band.maxOdds}`}
              className="flex flex-col gap-1.5 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {formatOddsBand(band, locale)}
                </p>
                {audience === "admin" ? (
                  <CalibrationVerdict
                    status={band.status}
                    ratio={ratio}
                    className="shrink-0"
                  />
                ) : null}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {band.sufficient &&
                band.market !== null &&
                band.realised !== null ? (
                  <>
                    Sur 100 pronostics que la cote donnait à{" "}
                    {Math.round(band.market * 100)} %,{" "}
                    <span className="font-semibold text-foreground">
                      {Math.round(band.realised * 100)} sont passés
                    </span>
                    .
                    {audience === "admin" && band.announced !== null
                      ? ` Le moteur annonçait ${Math.round(band.announced * 100)} %.`
                      : null}
                  </>
                ) : (
                  "Moins de 30 pronostics réglés : pas assez de recul pour lire cette tranche."
                )}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatCount(band.settled, locale)} réglés
                {band.sufficient
                  ? ` · à mise fixe ${formatSignedRate(
                      band.returnPerUnit === null
                        ? null
                        : band.returnPerUnit - 1,
                      locale,
                    )}`
                  : null}
              </p>
            </li>
          );
        })}
      </ul>
      {withoutOdds > 0 ? (
        <p className="text-xs leading-5 text-muted-foreground">
          {`${formatCount(withoutOdds, locale)} pronostics réglés n’avaient pas de cote relevée : ils comptent dans le total, dans aucune tranche.`}
        </p>
      ) : null}
    </section>
  );
}
