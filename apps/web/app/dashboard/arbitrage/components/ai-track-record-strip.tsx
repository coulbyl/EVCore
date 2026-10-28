"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useChannelStats } from "@/domains/dashboard/use-cases/get-channel-health";
import { daysAgoIso, formatDateLong, todayIso } from "@/lib/date";
import {
  formatCount,
  formatRate,
  formatSignedRate,
} from "@/app/dashboard/track-record/track-record-constants";

/** Même seuil que Mesures historiques : sous 30 avis réglés, pas de taux. */
const MIN_SETTLED = 30;
const WINDOW_DAYS = 30;

/**
 * Le bilan de l'IA en tête de l'écran, au format imposé par PRODUCT.md
 * (indicateur, dates, effectif, valeur), avec le résultat à mise fixe et la
 * phrase qui manquait : l'IA ne bat pas la cote du bookmaker (CLAUDE.md,
 * moteur derrière le marché ; résidu des avis v4 +1,0 point ± 2,7 sur 300
 * avis). Sans ce bilan, le joueur ne pouvait pas décider s'il suit un avis
 * (revue UX du 2026-10-27, P1-2). Même source que la ligne « Avis IA » de
 * Mesures historiques.
 */
export function AiTrackRecordStrip() {
  const t = useTranslations("arbitrage.track");
  const locale = useLocale();
  const from = daysAgoIso(WINDOW_DAYS);
  const to = todayIso();
  const { data } = useChannelStats(from, to);
  const ai = data?.find((row) => row.channel === "VANTAGE");

  return (
    <section
      data-testid="ai-track-record"
      className="flex flex-col gap-1 rounded-2xl border border-border bg-panel px-4 py-3 text-sm leading-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("title")}
      </h2>
      {ai && ai.sampleSize >= MIN_SETTLED ? (
        <p className="text-foreground">
          {t("line", {
            from: formatDateLong(from),
            to: formatDateLong(to),
            settled: formatCount(ai.sampleSize, locale),
            realised: formatRate(ai.hitRate, locale),
            market: formatRate(ai.market, locale),
            result: formatSignedRate(
              ai.roi === null ? null : ai.roi / 100,
              locale,
            ),
          })}
        </p>
      ) : (
        <p className="text-muted-foreground">{t("insufficient")}</p>
      )}
      <p className="text-muted-foreground">
        {t("market")}{" "}
        <Link
          href="/dashboard/track-record"
          className="font-medium text-accent underline underline-offset-4"
        >
          {t("link")}
        </Link>
      </p>
    </section>
  );
}
