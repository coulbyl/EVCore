"use client";

import { useTranslations } from "next-intl";
import { Badge, cn } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { AddToCouponButton } from "@/components/add-to-coupon-button";
import { CanalBadge } from "@/components/canal-badge";
import { ResultBadge } from "@/components/result-badge";
import type { BetSlipDraftItem } from "@/domains/bet-slip/types/bet-slip";
import type {
  InvestmentPick,
  InvestmentView,
} from "@/domains/investment/types/investment";
import { LegConnector } from "@/components/leg-connector";
import { formatPct, formatRoi } from "./investment-constants";

/**
 * Une ligne de pick.
 *
 * Ce qui a disparu par rapport à l'ancienne version, et pourquoi :
 * - le badge EV vert/rouge — l'EV se calcule sur l'edge revendiqué, mesuré
 *   ANTI-prédictif (taux réel plat 0.51 → 0.38 pendant que l'annoncé monte de
 *   0.481 à 0.699). L'afficher en vert revenait à mettre en avant l'ampleur
 *   de l'erreur du modèle.
 * - le badge de bucket (« Très probable », « Solide »…) — la probabilité
 *   calibrée est désormais fiable (ratio réalisé/annoncé 1.016), donc la
 *   ranger en 4 paliers ne fait que perdre de l'information.
 *
 * Ce qui est ajouté : la fréquence de réussite est toujours affichée à côté
 * de la cote (audit §5.1, règle 3 — « une cote sans son taux se lit comme une
 * promesse »), et hors surface de mise chaque pick porte le ROI shrinké de son
 * canal.
 */
export function InvestmentPickRow({
  pick,
  view,
  locale,
  connector,
}: {
  pick: InvestmentPick;
  view: InvestmentView;
  locale: string;
  connector: { show: boolean; isLast: boolean };
}) {
  const t = useTranslations("investment");
  const tChannels = useTranslations("decisions");
  const loc = locale === "en" ? "en" : "fr";

  const slipItem: BetSlipDraftItem = {
    fixtureId: pick.fixtureId,
    fixture: pick.fixture,
    homeLogo: pick.homeLogo,
    awayLogo: pick.awayLogo,
    competition: pick.competition ?? "",
    scheduledAt: pick.scheduledAt,
    market: pick.market,
    pick: pick.pick,
    odds: String(pick.odds),
    ev: pick.ev === null ? null : String(pick.ev),
    canal: pick.channel,
    stakeOverride: null,
  };

  const modelGap = Math.abs(pick.modelProbability - pick.probability) >= 0.02;

  return (
    <div className="flex py-2">
      {connector.show && <LegConnector isLast={connector.isLast} />}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-bold text-foreground">
            {formatPickForDisplay(pick.pick, pick.market)}
          </span>
          <span className="text-[0.68rem] text-muted-foreground">
            {formatMarketForDisplay(pick.market, loc)}
          </span>
          {/* La cote ne s'affiche jamais seule : le taux attendu la suit
              toujours, sur la même ligne. */}
          <span className="ml-auto text-sm font-bold tabular-nums text-foreground">
            {pick.odds.toFixed(2)}
          </span>
          <span className="text-[0.68rem] font-semibold tabular-nums text-foreground/80">
            {t("expectedRate", { rate: formatPct(pick.probability) })}
          </span>
        </div>

        {modelGap && (
          <p className="text-[0.62rem] text-muted-foreground">
            {t("modelProbability")} {formatPct(pick.modelProbability)}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <CanalBadge canal={pick.channel} />

          {view === "excluded" && pick.exclusionReason !== null && (
            <Badge
              variant="outline"
              className="border-destructive/30 text-[0.62rem] text-destructive"
            >
              {t(`exclusion.${pick.exclusionReason}`)}
            </Badge>
          )}

          {view === "watch" && pick.channelRoiSampleSize > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "text-[0.62rem] tabular-nums",
                pick.channelRoiShrunk >= 0
                  ? "border-success/30 text-success"
                  : "border-warning/30 text-warning",
              )}
              title={t("channelRoiHint", {
                channel: tChannels(`channels.${pick.channel}.label`),
                n: pick.channelRoiSampleSize,
              })}
            >
              {t("channelRoi", { roi: formatRoi(pick.channelRoiShrunk) })}
            </Badge>
          )}

          <ResultBadge
            result={pick.result}
            finished={pick.score !== null}
            market={pick.market}
          />
          {pick.score === null && view !== "excluded" && (
            <span className="ml-auto">
              <AddToCouponButton item={slipItem} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
