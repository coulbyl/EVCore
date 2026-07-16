import type { Metadata } from "next";
import Link from "next/link";
import {
  Badge,
  Page,
  PageContent,
  PageHeader,
  PageHeaderTitle,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evcore/ui";
import { serverApiRequest } from "@/lib/api/server-api";
import type {
  ChannelHealthItem,
  ChannelStatsItem,
} from "@/domains/dashboard/types/dashboard";
import { ChannelStatusBadge } from "./components/channel-status-badge";
import { PeriodTabs } from "./components/period-tabs";
import {
  CHANNEL_LABELS,
  dateRangeForPeriod,
  formatHitRate,
  formatRoi,
  mergeChannelData,
  resolvePeriod,
  type PnlByCanalResponse,
} from "./track-record-constants";

export const metadata: Metadata = {
  title: "Historique vérifiable — EVCore",
  description:
    "Le ROI et le taux de réussite réels de chaque canal EVCore, mesurés sur les paris effectivement réglés — historique daté, jamais une promesse.",
};

async function getTrackRecordData(from: string, to: string) {
  const [pnl, channelStats, channelHealth] = await Promise.all([
    serverApiRequest<PnlByCanalResponse>(
      `/dashboard/pnl?from=${from}&to=${to}`,
      { fallbackErrorMessage: "Impossible de charger le résumé." },
    ),
    serverApiRequest<ChannelStatsItem[]>(
      `/dashboard/channel-stats?from=${from}&to=${to}`,
      { fallbackErrorMessage: "Impossible de charger les canaux." },
    ),
    serverApiRequest<ChannelHealthItem[]>(
      `/dashboard/channel-health?from=${from}&to=${to}`,
      { fallbackErrorMessage: "Impossible de charger le statut des canaux." },
    ),
  ]);
  return { pnl, rows: mergeChannelData(channelStats, channelHealth) };
}

export default async function TrackRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = resolvePeriod(periodParam);
  const { from, to } = dateRangeForPeriod(period);
  const { pnl, rows } = await getTrackRecordData(from, to);

  return (
    <Page className="flex h-full flex-col">
      <PageHeader className="flex-col items-start gap-2">
        <Badge variant="accent" className="w-fit">
          Historique vérifiable
        </Badge>
        <PageHeaderTitle>Ce que le moteur EVCore a réellement produit</PageHeaderTitle>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Ces chiffres viennent des mêmes tables que celles utilisées pour
          calculer chaque pick — pas d&apos;échantillon trié, pas de canal
          caché. Un canal négatif reste affiché comme tel.{" "}
          <strong className="text-foreground">
            Historique daté, jamais une promesse de gain futur.
          </strong>
        </p>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5 ev-shell-shadow">
        <div className="flex flex-col gap-6">
          <PeriodTabs active={period} />

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Résumé — {from} → {to}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatCard
                label="Paris réglés"
                value={String(pnl.global.settledBets)}
              />
              <StatCard label="Taux de réussite" value={pnl.global.winRate} />
              <StatCard
                label="ROI"
                value={pnl.global.roi}
                tone={pnl.global.roi.startsWith("-") ? "danger" : "success"}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Par canal
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Canal</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">
                      Taux de réussite
                    </TableHead>
                    <TableHead className="text-right">Échantillon</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.channel}>
                      <TableCell className="font-medium text-foreground">
                        {CHANNEL_LABELS[row.channel]}
                      </TableCell>
                      <TableCell>
                        <ChannelStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRoi(row.roi)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatHitRate(row.hitRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        n={row.sampleSize}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              &quot;Échantillon insuffisant&quot; : moins de 30 paris réglés
              sur la période — pas assez de volume pour distinguer un vrai
              edge du bruit statistique. Un canal marqué comme tel
              n&apos;est ni recommandé, ni exclu — simplement pas encore
              mesurable.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-panel p-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Aucun de ces chiffres ne garantit une performance future — ce
              sont des résultats réels, mesurés sur des paris déjà réglés, à
              une date donnée. Un canal marqué positif peut redevenir
              négatif, et inversement.{" "}
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
