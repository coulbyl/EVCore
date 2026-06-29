// NOTE: This repository requires the calibration Postgres schema to exist.
// Run: prisma migrate dev --name add-calibration-schema  (via your CLI, not Claude Code)
// Then regenerate types: prisma generate (user manages via CLI)
//
// Until then, the Prisma client is cast through the PrismaClientWithCalibration
// bridge type defined in calibration-prisma.types.ts.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { StrategyChannel } from '@evcore/db';
import type Decimal from 'decimal.js';
import type { EvBin } from '@evcore/analysis-core';
import type {
  CalibrationReportRecord,
  ChannelTuningResultRecord,
  PrismaClientWithCalibration,
} from './calibration-prisma.types';

@Injectable()
export class CalibrationRepository {
  private get cal(): PrismaClientWithCalibration {
    return this.prisma.client as unknown as PrismaClientWithCalibration;
  }

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
    const record = await this.cal.calibrationReport.create({
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
  }): Promise<CalibrationReportRecord[]> {
    return this.cal.calibrationReport.findMany({
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
    const record = await this.cal.channelTuningResult.create({
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
  }): Promise<ChannelTuningResultRecord[]> {
    return this.cal.channelTuningResult.findMany({
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
