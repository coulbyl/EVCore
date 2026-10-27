import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import {
  Badge,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
  StatCard,
} from "@evcore/ui";
import { serverApiRequest } from "@/lib/api/server-api";
import type {
  ChannelCompetitionStatItem,
  ChannelHealthItem,
  ChannelStatsItem,
  TrackRecordSummary,
} from "@/domains/dashboard/types/dashboard";
import { channelLabel } from "../decisions/components/channel-constants";
import { ChannelCompetitionSection } from "./components/channel-competition-section";
import {
  ChannelStatsTable,
  type ChannelStatRow,
} from "./components/channel-stats-table";
import { PeriodTabs } from "./components/period-tabs";
import { formatDateLong } from "@/lib/date";
import { CompetitionRankingSection } from "./components/competition-ranking-section";
import { TodayCalibrationCard } from "@/app/dashboard/components/today-confidence-card";
import {
  dateRangeForPeriod,
  mergeChannelData,
  resolvePeriod,
} from "./track-record-constants";

export const metadata: Metadata = {
  title: "Mesures historiques — EVCore",
  description:
    "Résultats analytiques des sélections EVCore enregistrées avant match ; rendement simulé, versions historiques parfois inconnues.",
};

async function getTrackRecordData(from: string, to: string) {
  const [summary, channelStats, channelHealth, channelCompetitionStats] =
    await Promise.all([
      serverApiRequest<TrackRecordSummary>(
        `/dashboard/track-record-summary?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger le résumé." },
      ),
      serverApiRequest<ChannelStatsItem[]>(
        `/dashboard/channel-stats?from=${from}&to=${to}`,
        { fallbackErrorMessage: "Impossible de charger les canaux." },
      ),
      serverApiRequest<ChannelHealthItem[]>(
        `/dashboard/channel-health?from=${from}&to=${to}`,
        {
          fallbackErrorMessage: "Impossible de charger le statut des canaux.",
        },
      ),
      serverApiRequest<ChannelCompetitionStatItem[]>(
        `/dashboard/channel-stats-by-competition?from=${from}&to=${to}`,
        {
          fallbackErrorMessage:
            "Impossible de charger le détail par compétition.",
        },
      ),
    ]);
  return {
    summary,
    rows: mergeChannelData(channelStats, channelHealth),
    channelCompetitionStats,
  };
}

export default async function TrackRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { from, to } = dateRangeForPeriod(period);
  const [{ summary, rows, channelCompetitionStats }, locale] =
    await Promise.all([getTrackRecordData(from, to), getLocale()]);
  const channelStatRows: ChannelStatRow[] = rows.map((row) => ({
    key: row.channel,
    primaryLabel: channelLabel(row.channel, locale),
    status: row.status,
    roi: row.roi,
    hitRate: row.hitRate,
    calibrationRatio: row.calibrationRatio,
    sampleSize: row.sampleSize,
  }));

  return (
    <Page className="flex h-full flex-col">
      <PageHeader
        data-tour="track-record-title"
        className="flex-col items-start gap-2"
      >
        <Badge variant="accent" className="w-fit">
          Mesures historiques
        </Badge>
        <PageHeaderTitle>
          Ce que le moteur EVCore a réellement produit
        </PageHeaderTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Les tableaux de canaux décrivent les dernières sélections enregistrées
          avant match, à mise fixe. Les versions historiques peuvent être
          inconnues ; les avis IA modifiables sont exclus de cette cohorte.{" "}
          <strong className="text-foreground">
            Historique daté, jamais une promesse de gain futur.
          </strong>
        </p>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-6">
          <PeriodTabs active={period} />

          {/* Même source que le tableau par canal : sélections d'avant-match
              dédupliquées. L'ancien en-tête lisait la table `bet`, plus
              alimentée depuis le 2026-09-04 (« 1 pari, 100 %, +64 % » sur
              30 jours ; audit du 2026-10-23, P1-5). */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Annoncé et réalisé · du {formatDateLong(from)} au{" "}
              {formatDateLong(to)}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Pronostics réglés"
                value={summary.settled.toLocaleString(locale)}
              />
              <StatCard
                label="Annoncé"
                value={
                  summary.sufficient
                    ? formatRate(summary.announced, locale)
                    : "—"
                }
              />
              <StatCard
                label="Réalisé"
                value={
                  summary.sufficient
                    ? formatRate(summary.realised, locale)
                    : "—"
                }
              />
              <StatCard
                label="À mise fixe"
                tone="neutral"
                value={
                  summary.sufficient
                    ? formatSignedReturn(summary.returnPerUnit, locale)
                    : "—"
                }
              />
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {summary.sufficient
                ? "Tous les canaux, hors filtres et avis IA, une ligne par pari réel, analyses faites avant le coup d'envoi, à la cote d'analyse. Chez ton bookmaker, la cote est en général un peu plus basse."
                : "Volume insuffisant : moins de 30 pronostics réglés sur la période, les taux ne se lisent pas encore."}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Par canal
            </h2>
            <ChannelStatsTable
              primaryColumnLabel="Canal"
              rows={channelStatRows}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              &quot;Volume insuffisant&quot; : moins de 30 sélections réglées
              sur la période. Ce volume ne permet pas encore d&apos;interpréter
              l&apos;écart entre probabilité annoncée et réussite réelle.
            </p>
          </section>

          <ChannelCompetitionSection rows={channelCompetitionStats} />

          {/* Déplacés de l'accueil le 2026-10-11 : la calibration des canaux
              actifs du jour et le classement des ligues sont des mesures,
              elles se lisent ici, à côté des autres. */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TodayCalibrationCard from={from} to={to} />
            <CompetitionRankingSection />
          </div>

          <section className="rounded-2xl border border-border bg-panel p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Aucun de ces chiffres ne garantit une performance future — ce sont
              des résultats analytiques et des règlements enregistrés dans
              EVCore, sans preuve de mise ni de paiement chez un bookmaker. Un
              canal marqué positif peut redevenir négatif, et inversement.{" "}
              <Link
                href="/dashboard/formation/channels/channels-overview"
                className="font-medium text-accent underline underline-offset-4 hover:text-accent/80"
              >
                Comprendre les canaux
              </Link>{" "}
              pour savoir comment les lire correctement.
            </p>
          </section>
        </div>
      </PageContent>
    </Page>
  );
}

/** 0,459 → « 45,9 % ». */
function formatRate(rate: number | null, locale: string): string {
  if (rate === null) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(rate);
}

/** Retour par unité → résultat signé : 0,91 → « −9 % ». */
function formatSignedReturn(perUnit: number | null, locale: string): string {
  if (perUnit === null) return "—";
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })
    .format(perUnit - 1)
    .replace("-", "\u2212");
}
