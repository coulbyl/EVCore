import { Injectable, NotFoundException } from '@nestjs/common';
import { CONSOLE_CALIBRATION } from '@config/console.constants';
import { DashboardService } from '@modules/dashboard/dashboard.service';
import { ResultsService, spanOf } from '@modules/screens/results.service';
import type { ResultsPeriod } from '@modules/screens/results.types';
import { formatDateUtc, startOfUtcDay } from '@utils/date.utils';
import { ConsoleRepository } from './console.repository';
import { cellOf } from './console-calibration';
import type {
  ChannelCell,
  EngineProducts,
  SuspendedMarket,
} from './console.types';

/**
 * Moteur — « tient-il ce qu'il annonce ? » (12-admin.md § 2): Résultats'
 * products with retired ones, plus what the player never sees (CLV, the
 * 1xBet margin paid, legs), and the AI by configuration version.
 */
const CHANNELS_CACHE_MS = 10 * 60 * 1000;

@Injectable()
export class ConsoleEngineService {
  constructor(
    private readonly results: ResultsService,
    private readonly repository: ConsoleRepository,
    private readonly dashboard: DashboardService,
  ) {}

  /**
   * Canaux × compétition over 90 rolling days, alerts first, then by
   * sample: the settled legs the dashboard already counts (deduplicated).
   */
  // The dashboard reads 90 days of legs (seconds): one read per ten minutes
  // serves the home and Moteur alike.
  private channelsCache: { at: number; cells: Promise<ChannelCell[]> } | null =
    null;

  getChannels(now: Date = new Date()): Promise<ChannelCell[]> {
    const fresh =
      this.channelsCache &&
      now.getTime() - this.channelsCache.at < CHANNELS_CACHE_MS;
    if (!fresh) {
      const cells = this.readChannels(now);
      this.channelsCache = { at: now.getTime(), cells };
      // A failed read is not kept: the next one tries again.
      cells.catch(() => {
        this.channelsCache = null;
      });
    }
    return (this.channelsCache as { cells: Promise<ChannelCell[]> }).cells;
  }

  private async readChannels(now: Date): Promise<ChannelCell[]> {
    const to = formatDateUtc(now);
    const from = formatDateUtc(
      new Date(
        now.getTime() - (CONSOLE_CALIBRATION.WINDOW_DAYS - 1) * 86_400_000,
      ),
    );
    const items = await this.dashboard.getChannelStatsByCompetition(from, to);
    const rank = { alert: 0, optimistic: 1, conforme: 2, not_enough: 3 };
    return items
      .map((item) =>
        cellOf({
          channel: item.channel,
          competitionCode: item.competitionCode,
          competitionName: item.competitionName,
          sample: item.sampleSize,
          announced: item.announced,
          realised: item.hitRate,
          enough:
            item.status !== 'INSUFFICIENT_DATA' && item.status !== 'INACTIVE',
        }),
      )
      .sort((a, b) => rank[a.word] - rank[b.word] || b.sample - a.sample);
  }

  async getSuspensions(): Promise<SuspendedMarket[]> {
    const rows = await this.repository.activeSuspensionsFull();
    return rows.map((row) => ({
      id: row.id,
      market: row.market,
      since: row.createdAt.toISOString(),
      reason: row.reason,
    }));
  }

  /**
   * A human reactivates a suspended market (CLAUDE.md: never automatic).
   * The reason is required; the journal records it (G11).
   */
  async reactivate(input: {
    id: string;
    reason: string;
  }): Promise<SuspendedMarket> {
    const row = await this.repository.liftSuspension(input.id);
    if (!row) throw new NotFoundException('Suspension inconnue ou déjà levée');
    return {
      id: row.id,
      market: row.market,
      since: row.createdAt.toISOString(),
      reason: row.reason,
    };
  }

  async getProducts(
    period: ResultsPeriod,
    now: Date = new Date(),
  ): Promise<EngineProducts> {
    const span = spanOf(period, startOfUtcDay(now));
    const [screen, legs, versions] = await Promise.all([
      this.results.getResults({ period, isAdmin: true }, now),
      this.repository.productLegs(span),
      this.repository.aiVersions({ span, asOf: now }),
    ]);
    const legsOf = new Map(legs.map((row) => [row.product, row]));
    const totalAi = versions.reduce(
      (acc, v) => {
        const n = Number(v.won) + Number(v.lost);
        acc.n += n;
        acc.margin += (v.margin ?? 0) * n;
        acc.marginN += v.margin === null ? 0 : n;
        return acc;
      },
      { n: 0, margin: 0, marginN: 0 },
    );
    return {
      period,
      products: screen.products.map((p) => ({
        product: p.product,
        retired: p.retired,
        launchedOn: p.launchedOn,
        won: p.won,
        lost: p.lost,
        refunded: p.refunded,
        tooEarly: p.tooEarly,
        announced: p.comparison?.announced ?? null,
        realised: p.comparison?.realised ?? null,
        legs: legsOf.get(p.product)?.legs ?? 0,
        clv: legsOf.get(p.product)?.clv ?? null,
        margin: legsOf.get(p.product)?.margin ?? null,
      })),
      ai: {
        won: screen.ai.won,
        lost: screen.ai.lost,
        announced: screen.ai.comparison?.announced ?? null,
        realised: screen.ai.comparison?.realised ?? null,
        margin: totalAi.marginN > 0 ? totalAi.margin / totalAi.marginN : null,
        versions: versions.map((v) => ({
          version: v.version,
          from: formatDateUtc(v.from),
          to: formatDateUtc(v.to),
          won: Number(v.won),
          lost: Number(v.lost),
          announced: v.announced,
          margin: v.margin,
        })),
      },
    };
  }
}
