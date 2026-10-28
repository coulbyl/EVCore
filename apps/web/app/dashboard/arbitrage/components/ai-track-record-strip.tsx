"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAiTrackRecord } from "@/domains/dashboard/use-cases/get-ai-track-record";
import {
  daysAgoIso,
  formatDateLong,
  formatDateShort,
  todayIso,
} from "@/lib/date";
import {
  formatCount,
  formatRate,
  formatSignedRate,
} from "@/app/dashboard/track-record/track-record-constants";

/** Même seuil que Mesures historiques : sous 30 avis réglés, pas de taux. */
const MIN_SETTLED = 30;
const WINDOW_DAYS = 30;

/** « vantage-v4-gated » → « v4 ». */
function versionLabel(configVersion: string | null): string {
  return /v\d+/.exec(configVersion ?? "")?.[0] ?? "—";
}

function points(value: number, locale: string): string {
  return (value * 100).toLocaleString(locale === "en" ? "en-US" : "fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
}

/**
 * Le bilan de l'IA en tête de l'écran, au format imposé par PRODUCT.md
 * (indicateur, dates, effectif, valeur). Il est lu sur l'historique figé des
 * avis (vantage_decision_history), jamais sur la ligne vivante réécrite par
 * upsert : avant le 2026-10-29 la cohorte commune excluait l'IA et la bande
 * restait vide. L'écart au marché porte sa marge d'erreur ; tant qu'elle
 * contient zéro, la phrase du marché reste : l'IA ne bat pas la cote.
 */
export function AiTrackRecordStrip() {
  const t = useTranslations("arbitrage.track");
  const locale = useLocale();
  const from = daysAgoIso(WINDOW_DAYS);
  const to = todayIso();
  const { data } = useAiTrackRecord(from, to);
  const total = data?.total;
  const enough = total !== undefined && total.settled >= MIN_SETTLED;
  const beatsMarket =
    enough &&
    total.gap !== null &&
    total.gapMargin !== null &&
    total.gap - total.gapMargin > 0;

  return (
    <section
      data-testid="ai-track-record"
      className="flex flex-col gap-1 rounded-2xl border border-border bg-panel px-4 py-3 text-sm leading-6"
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t("title")}
      </h2>
      {enough ? (
        <>
          <p className="text-foreground">
            {t("line", {
              from: formatDateLong(from),
              to: formatDateLong(to),
              settled: formatCount(total.settled, locale),
              realised: formatRate(total.realised, locale),
              announced: formatRate(total.announced, locale),
              market: formatRate(total.market, locale),
              result: formatSignedRate(total.flatReturn, locale),
            })}
          </p>
          {total.gap !== null && total.gapMargin !== null ? (
            <p className="text-muted-foreground">
              {t("gap", {
                gap: points(total.gap, locale),
                margin: points(total.gapMargin, locale).replace(/^\+/, ""),
              })}
            </p>
          ) : null}
          {data && data.versions.length > 1 ? (
            <p className="text-muted-foreground">
              {t("versions", {
                list: data.versions
                  .map((v) =>
                    t("version", {
                      version: versionLabel(v.configVersion),
                      first: formatDateShort(v.firstDay ?? from),
                      last: formatDateShort(v.lastDay ?? to),
                      settled: formatCount(v.settled, locale),
                    }),
                  )
                  .join(" · "),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-muted-foreground">{t("insufficient")}</p>
      )}
      <p className="text-muted-foreground">
        {beatsMarket ? t("aboveMarket") : t("market")}{" "}
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
