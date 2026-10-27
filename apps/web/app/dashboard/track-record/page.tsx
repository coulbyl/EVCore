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
import { OddsBandSection } from "./components/odds-band-section";
import { PeriodTabs } from "./components/period-tabs";
import { formatDateLong } from "@/lib/date";
import {
  OUT_OF_TOTAL_CHANNELS,
  dateRangeForPeriod,
  formatCount,
  formatRate,
  formatSignedRate,
  mergeChannelData,
  resolvePeriod,
  type PeriodKey,
} from "./track-record-constants";

export const metadata: Metadata = {
  title: "Mesures historiques — EVCore",
  description:
    "Ce que nos pronostics de football ont vraiment donné : annoncé et réalisé, par cote et par canal, pertes comprises.",
};

/**
 * Chaque bloc a sa requête et son repli : avec `Promise.all`, une seule
 * réponse lente ou en échec sur un réseau mobile faisait tomber toute la
 * page, en-tête compris (audit UX du 2026-10-27).
 */
async function getTrackRecordData(from: string, to: string) {
  const query = `from=${from}&to=${to}`;
  const [summary, channelStats, channelHealth, channelCompetitionStats] =
    await Promise.allSettled([
      serverApiRequest<TrackRecordSummary>(
        `/dashboard/track-record-summary?${query}`,
      ),
      serverApiRequest<ChannelStatsItem[]>(`/dashboard/channel-stats?${query}`),
      serverApiRequest<ChannelHealthItem[]>(
        `/dashboard/channel-health?${query}`,
      ),
      serverApiRequest<ChannelCompetitionStatItem[]>(
        `/dashboard/channel-stats-by-competition?${query}`,
      ),
    ]);
  return {
    summary: summary.status === "fulfilled" ? summary.value : null,
    // Sans la santé, chaque canal retomberait sur « pas assez de recul » :
    // mieux vaut annoncer le bloc manquant que d'afficher un faux verdict.
    rows:
      channelStats.status === "fulfilled" &&
      channelHealth.status === "fulfilled"
        ? mergeChannelData(channelStats.value, channelHealth.value)
        : null,
    channelCompetitionStats:
      channelCompetitionStats.status === "fulfilled"
        ? channelCompetitionStats.value
        : null,
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
  const toRow = (row: NonNullable<typeof rows>[number]): ChannelStatRow => ({
    key: row.channel,
    primaryLabel: channelLabel(row.channel, locale),
    status: row.status,
    announced: row.announced,
    realised: row.hitRate,
    calibrationRatio: row.calibrationRatio,
    roi: row.roi,
    sampleSize: row.sampleSize,
  });
  const channelStatRows = (rows ?? [])
    .filter((row) => !OUT_OF_TOTAL_CHANNELS.has(row.channel))
    .map(toRow);
  const aiOpinions = rows?.find((row) => row.channel === "VANTAGE");

  return (
    <Page className="flex h-full flex-col">
      <PageHeader
        data-tour="track-record-title"
        className="flex-col items-start gap-2 lg:flex-col lg:items-start lg:justify-start"
      >
        <Badge variant="accent" className="w-fit">
          Mesures historiques
        </Badge>
        <PageHeaderTitle className="text-balance">
          Ce que nos pronostics ont vraiment donné
        </PageHeaderTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Chaque pronostic publié avant le match, compté une seule fois et réglé
          avec le vrai résultat. Pertes comprises.{" "}
          <strong className="text-foreground">
            C&apos;est un historique, pas une promesse.
          </strong>
        </p>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        {/* pb-20 : le bouton flottant de l'assistant ne recouvre plus la
            dernière ligne. */}
        <div className="flex flex-col gap-8 pb-20">
          <PeriodTabs active={period} />

          {/* Sélections d'avant-match dédupliquées, une ligne par pari réel.
              L'ancien en-tête lisait la table `bet`, plus alimentée depuis le
              2026-09-04 (audit du 2026-10-23, P1-5). */}
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Annoncé et réalisé · du {formatDateLong(from)} au{" "}
              {formatDateLong(to)}
            </h2>
            {summary ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {/* Ton neutre partout : en accent, le trait sous le chiffre
                      se lisait comme une jauge remplie à 100 %. */}
                  <StatCard
                    tone="neutral"
                    label="Pronostics réglés"
                    value={formatCount(summary.settled, locale)}
                  />
                  <StatCard
                    tone="neutral"
                    label="Annoncé"
                    value={
                      summary.sufficient
                        ? formatRate(summary.announced, locale)
                        : "—"
                    }
                  />
                  <StatCard
                    tone="neutral"
                    label="Réalisé"
                    value={
                      summary.sufficient
                        ? formatRate(summary.realised, locale)
                        : "—"
                    }
                  />
                  <StatCard
                    tone="neutral"
                    label="À mise fixe"
                    value={
                      summary.sufficient
                        ? formatSignedRate(
                            summary.returnPerUnit === null
                              ? null
                              : summary.returnPerUnit - 1,
                            locale,
                          )
                        : "—"
                    }
                  />
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  {summary.sufficient
                    ? "Une ligne par pronostic réel, publié avant le coup d'envoi, à la cote d'analyse. Chez ton bookmaker, la cote est en général un peu plus basse."
                    : "Moins de 30 pronostics réglés sur la période : les taux ne se lisent pas encore."}
                </p>
              </>
            ) : (
              <SectionUnavailable period={period} />
            )}
          </section>

          {summary?.sufficient ? (
            <OddsBandSection
              bands={summary.byOdds}
              settledTotal={summary.settled}
              locale={locale}
            />
          ) : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Par canal
            </h2>
            {rows ? (
              <>
                <ChannelStatsTable
                  primaryColumnLabel="Canal"
                  rows={channelStatRows}
                  countNoun={{ one: "canal", other: "canaux" }}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  <strong className="font-medium text-foreground">
                    Conforme
                  </strong>{" "}
                  : le réalisé reste à moins de 15 % de l&apos;annoncé.{" "}
                  <strong className="font-medium text-foreground">
                    Optimiste
                  </strong>{" "}
                  : moins de pronostics passés qu&apos;annoncé ;{" "}
                  <strong className="font-medium text-foreground">
                    prudent
                  </strong>{" "}
                  : plus. « Pas assez de recul » : moins de 30 réglés sur la
                  période.
                </p>
                {aiOpinions && aiOpinions.sampleSize > 0 ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Avis IA, hors total car ils reprennent des matchs déjà
                    comptés : annoncé {formatRate(aiOpinions.announced, locale)}
                    , réalisé {formatRate(aiOpinions.hitRate, locale)}, sur{" "}
                    {formatCount(aiOpinions.sampleSize, locale)} réglés.{" "}
                    <Link
                      href="/dashboard/arbitrage"
                      className="font-medium text-accent underline underline-offset-4"
                    >
                      Voir les avis IA
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <SectionUnavailable period={period} />
            )}
          </section>

          {channelCompetitionStats ? (
            <ChannelCompetitionSection rows={channelCompetitionStats} />
          ) : (
            <section className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Par compétition
              </h2>
              <SectionUnavailable period={period} />
            </section>
          )}

          <p className="max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
            Ces chiffres sont des résultats enregistrés dans EVCore, sans preuve
            de mise ni de paiement chez un bookmaker. Ils décrivent le passé,
            pas la suite.{" "}
            <Link
              href="/dashboard/formation/channels-overview"
              className="font-medium text-accent underline underline-offset-4"
            >
              Comprendre les canaux
            </Link>
          </p>
        </div>
      </PageContent>
    </Page>
  );
}

function SectionUnavailable({ period }: { period: PeriodKey }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
      Ce bloc n&apos;a pas chargé.{" "}
      <Link
        href={`/dashboard/track-record?period=${period}`}
        prefetch={false}
        className="font-medium text-accent underline underline-offset-4"
      >
        Réessaie
      </Link>
    </p>
  );
}
