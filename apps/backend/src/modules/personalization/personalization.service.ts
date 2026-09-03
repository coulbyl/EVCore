import { BadRequestException, Injectable } from '@nestjs/common';
import { POOL_ELIGIBLE_CHANNELS } from '@evcore/analysis-core';
import type { StrategyChannel } from '@evcore/db';
import { DashboardService } from '@modules/dashboard/dashboard.service';
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
  calibrationRatio: number | null;
  sampleSize: number;
  proven: boolean;
  followed: boolean;
};

const ELIGIBLE_CHANNEL_SET = new Set<StrategyChannel>(POOL_ELIGIBLE_CHANNELS);

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
  // §2quater) : jamais les filtres Phase-2 (VALUE/SAFE) ni les méta-canaux
  // Phase-3 (CONSENSUS/CONTRARIAN/AVOID/VANTAGE) — même liste que le pool de
  // coupon (POOL_ELIGIBLE_CHANNELS), calibration déjà calculée ailleurs
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

    return POOL_ELIGIBLE_CHANNELS.map((channel) => {
      const measured = healthByChannel.get(channel);
      return {
        channel,
        calibrationRatio: measured?.calibrationRatio ?? null,
        sampleSize: measured?.sampleSize ?? 0,
        proven: measured?.status === 'GREEN',
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
