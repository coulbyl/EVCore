import { BadRequestException, Injectable } from '@nestjs/common';
import { POOL_ELIGIBLE_CHANNELS } from '@evcore/analysis-core';
import type { StrategyChannel } from '@evcore/db';
import { DashboardService } from '@modules/dashboard/dashboard.service';
import type { ChannelStatus } from '@modules/dashboard/dashboard.types';
import { PersonalizationRepository } from './personalization.repository';

export type FollowedChannelView = { channel: StrategyChannel; since: string };
export type FollowedLeagueView = {
  code: string;
  name: string;
  country: string;
  since: string;
};

export type DiscoverableChannel = {
  channel: StrategyChannel;
  // Same GREEN/ORANGE/RED/INACTIVE/INSUFFICIENT_DATA classification as the
  // track-record page and the Decisions/Arbitrage pick badges
  // (ChannelStatusBadge) — one qualitative verdict, never the raw
  // calibrationRatio/sampleSize the frontend used to print directly
  // ("0.97× · n=2000" reads as internal jargon to a lambda user).
  status: ChannelStatus;
  sampleSize: number;
  followed: boolean;
};

// VANTAGE is excluded here on top of POOL_ELIGIBLE_CHANNELS: it stays
// eligible for the real coupon pool (apps/vantage-worker), but "following" it
// through this generic mechanism serves no purpose — it already has its own
// dedicated page (Arbitrage) with its own reliability display.
const FOLLOWABLE_CHANNELS = POOL_ELIGIBLE_CHANNELS.filter(
  (channel) => channel !== 'VANTAGE',
);
const ELIGIBLE_CHANNEL_SET = new Set<StrategyChannel>(FOLLOWABLE_CHANNELS);

// Calibration window for the "Découvrir des canaux" list — same 90-day
// default as the rest of the calibration surface (dashboard/coupon-indices).
const DISCOVER_WINDOW_DAYS = 90;

@Injectable()
export class PersonalizationService {
  constructor(
    private readonly repo: PersonalizationRepository,
    private readonly dashboard: DashboardService,
  ) {}

  async getPersonalization(userId: string): Promise<{
    followedChannels: FollowedChannelView[];
    followedLeagues: FollowedLeagueView[];
  }> {
    const [channels, leagues] = await Promise.all([
      this.repo.listFollowedChannels(userId),
      this.repo.listFollowedLeagues(userId),
    ]);
    return {
      followedChannels: channels.map((c) => ({
        channel: c.channel,
        since: c.createdAt.toISOString(),
      })),
      followedLeagues: leagues.map((l) => ({
        code: l.competitionCode,
        name: l.name,
        country: l.country,
        since: l.createdAt.toISOString(),
      })),
    };
  }

  async getLeagueCatalog() {
    return this.repo.findActiveCompetitions();
  }

  // Canaux éligibles au suivi (docs/vantage-centric-redesign-2026-09-01.md
  // §2quater) : jamais les filtres Phase-2 (VALUE/SAFE), les méta-canaux
  // Phase-3 (CONSENSUS/CONTRARIAN/AVOID), les canaux jamais implémentés
  // (UNDERDOG/FAVORITE/LIVE_VALUE/MARKET_MOVE), ni VANTAGE (déjà sa propre
  // page dédiée, Arbitrage) — calibration déjà calculée ailleurs
  // (DashboardService.getChannelHealth), jamais un ROI.
  async discoverChannels(userId: string): Promise<DiscoverableChannel[]> {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - DISCOVER_WINDOW_DAYS * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const [health, followed] = await Promise.all([
      this.dashboard.getChannelHealth(from, to),
      this.repo.listFollowedChannels(userId),
    ]);
    const followedSet = new Set(followed.map((f) => f.channel));
    const healthByChannel = new Map(health.map((h) => [h.channel, h]));

    return FOLLOWABLE_CHANNELS.map((channel) => {
      const measured = healthByChannel.get(channel);
      return {
        channel,
        status: measured?.status ?? 'INSUFFICIENT_DATA',
        sampleSize: measured?.sampleSize ?? 0,
        followed: followedSet.has(channel),
      };
    });
  }

  async followChannel(userId: string, channel: string): Promise<void> {
    const validated = this.validateChannel(channel);
    await this.repo.followChannel(userId, validated);
  }

  async unfollowChannel(userId: string, channel: string): Promise<void> {
    const validated = this.validateChannel(channel);
    await this.repo.unfollowChannel(userId, validated);
  }

  async followLeague(userId: string, code: string): Promise<void> {
    await this.assertActiveCompetition(code);
    await this.repo.followLeague(userId, code);
  }

  async unfollowLeague(userId: string, code: string): Promise<void> {
    await this.repo.unfollowLeague(userId, code);
  }

  private validateChannel(channel: string): StrategyChannel {
    if (!ELIGIBLE_CHANNEL_SET.has(channel as StrategyChannel)) {
      throw new BadRequestException(`Canal non suivable : ${channel}`);
    }
    return channel as StrategyChannel;
  }

  private async assertActiveCompetition(code: string): Promise<void> {
    const exists = await this.repo.competitionExists(code);
    if (!exists) {
      throw new BadRequestException(`Championnat inconnu ou inactif : ${code}`);
    }
  }
}
