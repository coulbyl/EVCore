import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  Badge,
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
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-16">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Retour à l&apos;accueil
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <Badge variant="accent" className="w-fit">
          Historique vérifiable
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ce que le moteur EVCore a réellement produit
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          Ces chiffres viennent des mêmes tables que celles utilisées pour
          calculer chaque pick — pas d&apos;échantillon trié, pas de canal
          caché. Un canal négatif reste affiché comme tel.{" "}
          <strong className="text-foreground">
            Historique daté, jamais une promesse de gain futur.
          </strong>
        </p>
      </header>

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
                <TableHead className="text-right">Taux de réussite</TableHead>
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
          &quot;Échantillon insuffisant&quot; : moins de 30 paris réglés sur la
          période — pas assez de volume pour distinguer un vrai edge du bruit
          statistique. Un canal marqué comme tel n&apos;est ni recommandé, ni
          exclu — simplement pas encore mesurable.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-panel p-5">
        <p className="text-sm leading-6 text-muted-foreground">
          Aucun de ces chiffres ne garantit une performance future — ce sont
          des résultats réels, mesurés sur des paris déjà réglés, à une date
          donnée. Un canal marqué positif peut redevenir négatif, et
          inversement.{" "}
          <Link
            href="/auth/register"
            className="font-medium text-accent underline underline-offset-4 hover:text-accent/80"
          >
            Créer un compte
          </Link>{" "}
          pour suivre ces chiffres dans le temps et comprendre comment ils
          sont construits.
        </p>
      </section>

      <div>
        <Link
          href="/auth/register"
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
        >
          Commencer
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
