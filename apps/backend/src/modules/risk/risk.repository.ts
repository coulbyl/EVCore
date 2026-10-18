import { Injectable } from '@nestjs/common';
import { Market, NotificationType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { RISK_CONSTANTS } from './risk.constants';

/** One settled leg of the engine's real sample: a (channel, fixture,
 * market, pick) bet once, at the price it carried. */
export type SettledLegRow = {
  result: 'WON' | 'LOST';
  odds: number;
};

@Injectable()
export class RiskRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The engine's settled legs on a market since `since`, one row per real
   * bet. Reads `channel_selection_deduped` (a fixture is re-analysed 5 to 7
   * times before kickoff and every run writes its own row; the view keeps
   * the last pre-kickoff reading only). The `bet` table this guard-rail
   * used to read stopped receiving engine bets on 2026-09-04. Observation
   * channels (VALUE, SAFE: no bet, no display since 2026-09-03) are left
   * out — the rule is about what the engine actually proposes.
   */
  async findSettledLegs(market: Market, since: Date): Promise<SettledLegRow[]> {
    const excluded = [...RISK_CONSTANTS.ROI_EXCLUDED_CHANNELS];
    return this.prisma.client.$queryRaw<SettledLegRow[]>`
      SELECT result::text AS result, odds::float AS odds
      FROM channel_selection_deduped
      WHERE market::text = ${market}
        AND result IN ('WON', 'LOST')
        AND odds IS NOT NULL
        AND "settledAt" >= ${since}
        AND channel::text <> ALL(${excluded}::text[])
      ORDER BY "settledAt" DESC
    `;
  }

  /** Whether a ROI alert for this market was already raised since `since`
   * — the sweep runs daily and every market is priced against us, so an
   * alert re-emitted at every pass would be noise, not a signal. */
  async hasRoiAlertSince(market: Market, since: Date): Promise<boolean> {
    const row = await this.prisma.client.notification.findFirst({
      where: {
        type: NotificationType.ROI_ALERT,
        createdAt: { gte: since },
        payload: { path: ['market'], equals: market },
      },
      select: { id: true },
    });
    return row !== null;
  }
}
