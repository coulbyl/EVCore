import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type {
  CalibrationReport,
  ChannelTuningResult,
  StrategyChannel,
} from '@evcore/db';
import type Decimal from 'decimal.js';
import type { EvBin } from '@evcore/analysis-core';

@Injectable()
export class CalibrationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveReport(input: {
    channel: StrategyChannel;
    competitionCode: string | null;
    startDate: Date;
    endDate: Date;
    betCount: number;
    brierScore: Decimal;
    calibrationError: Decimal;
    roi: Decimal;
    evBins: EvBin[];
    triggeredBy?: string;
  }): Promise<string> {
    const record = await this.prisma.client.calibrationReport.create({
      data: {
        channel: input.channel,
        competitionCode: input.competitionCode,
        startDate: input.startDate,
        endDate: input.endDate,
        betCount: input.betCount,
        brierScore: input.brierScore.toFixed(6),
        calibrationError: input.calibrationError.toFixed(6),
        roi: input.roi.toFixed(5),
        evBins: input.evBins,
        triggeredBy: input.triggeredBy ?? 'auto',
      },
      select: { id: true },
    });
    return record.id;
  }

  async listReports(opts: {
    channel?: StrategyChannel;
    limit?: number;
  }): Promise<
    Pick<
      CalibrationReport,
      | 'id'
      | 'channel'
      | 'competitionCode'
      | 'startDate'
      | 'endDate'
      | 'betCount'
      | 'brierScore'
      | 'calibrationError'
      | 'roi'
      | 'createdAt'
    >[]
  > {
    return this.prisma.client.calibrationReport.findMany({
      where: { channel: opts.channel },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
      select: {
        id: true,
        channel: true,
        competitionCode: true,
        startDate: true,
        endDate: true,
        betCount: true,
        brierScore: true,
        calibrationError: true,
        roi: true,
        createdAt: true,
      },
    });
  }

  async saveTuningResult(input: {
    channel: StrategyChannel;
    competitionCode: string | null;
    configSnapshot: object;
    betCount: number;
    roi: Decimal;
    hitRate: Decimal;
    maxDrawdown: Decimal;
    improved: boolean;
  }): Promise<string> {
    const record = await this.prisma.client.channelTuningResult.create({
      data: {
        channel: input.channel,
        competitionCode: input.competitionCode,
        configSnapshot: input.configSnapshot,
        betCount: input.betCount,
        roi: input.roi.toFixed(5),
        hitRate: input.hitRate.toFixed(4),
        maxDrawdown: input.maxDrawdown.toFixed(5),
        improved: input.improved,
      },
      select: { id: true },
    });
    return record.id;
  }

  async listTuningResults(opts: {
    channel?: StrategyChannel;
    limit?: number;
  }): Promise<
    Pick<
      ChannelTuningResult,
      | 'id'
      | 'channel'
      | 'roi'
      | 'hitRate'
      | 'maxDrawdown'
      | 'improved'
      | 'appliedAt'
      | 'createdAt'
    >[]
  > {
    return this.prisma.client.channelTuningResult.findMany({
      where: { channel: opts.channel },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 50,
      select: {
        id: true,
        channel: true,
        roi: true,
        hitRate: true,
        maxDrawdown: true,
        improved: true,
        appliedAt: true,
        createdAt: true,
      },
    });
  }
}
