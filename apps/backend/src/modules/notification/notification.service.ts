import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';
import { Market } from '@evcore/db';

const logger = pino({ name: 'notification-service' });

type NovuPayload = Record<string, unknown>;

export type WeeklyReportPayload = {
  roiOneXTwo: number;
  betsPlaced: number;
  brierScore: number;
  periodStart: Date;
  periodEnd: Date;
};

@Injectable()
export class NotificationService {
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;
  private readonly subscriberId: string;
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiUrl = config
      .get<string>('NOVU_API_URL', 'http://localhost:3010')
      .replace(/\/$/, '');
    this.apiKey = config.get<string>('NOVU_API_KEY');
    this.subscriberId = config.get<string>(
      'NOVU_SUBSCRIBER_ID',
      'evcore-admin',
    );
    this.enabled =
      config.get<string>('NOVU_ALERTS_ENABLED', 'true') !== 'false';
  }

  async sendRoiAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    await this.trigger('evcore-roi-alert', {
      market,
      roi: roi.toFixed(4),
      betCount,
      alertedAt: new Date().toISOString(),
    });
  }

  async sendMarketSuspensionAlert(
    market: Market,
    roi: number,
    betCount: number,
  ): Promise<void> {
    await this.trigger('evcore-market-suspension', {
      market,
      roi: roi.toFixed(4),
      betCount,
      suspendedAt: new Date().toISOString(),
    });
  }

  async sendBrierScoreAlert(
    seasonId: string,
    brierScore: number,
  ): Promise<void> {
    await this.trigger('evcore-brier-alert', {
      seasonId,
      brierScore: brierScore.toFixed(6),
      alertedAt: new Date().toISOString(),
    });
  }

  async sendEtlFailureAlert(
    queue: string,
    jobName: string,
    errorMessage: string,
  ): Promise<void> {
    await this.trigger('evcore-etl-failure', {
      queue,
      jobName,
      errorMessage,
      failedAt: new Date().toISOString(),
    });
  }

  async sendWeightAdjustmentAlert(payload: {
    proposalId: string;
    isRollback: boolean;
    brierScore?: number;
    meanError?: number;
    rolledBackProposalId?: string;
  }): Promise<void> {
    await this.trigger('evcore-weight-adjustment', {
      proposalId: payload.proposalId,
      isRollback: payload.isRollback,
      brierScore: payload.brierScore?.toFixed(6),
      meanError: payload.meanError?.toFixed(6),
      rolledBackProposalId: payload.rolledBackProposalId,
      appliedAt: new Date().toISOString(),
    });
  }

  async sendWeeklyReport(payload: WeeklyReportPayload): Promise<void> {
    await this.trigger('evcore-weekly-report', {
      roiOneXTwo: payload.roiOneXTwo.toFixed(4),
      betsPlaced: payload.betsPlaced,
      brierScore: payload.brierScore.toFixed(6),
      periodStart: payload.periodStart.toISOString(),
      periodEnd: payload.periodEnd.toISOString(),
    });
  }

  private async trigger(
    workflowId: string,
    payload: NovuPayload,
  ): Promise<void> {
    if (!this.enabled) {
      logger.info({ workflowId }, 'Novu alerts disabled — skipping');
      return;
    }
    if (!this.apiKey) {
      logger.warn({ workflowId }, 'NOVU_API_KEY not set — skipping');
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/v1/events/trigger`, {
        method: 'POST',
        headers: {
          Authorization: `ApiKey ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workflowId,
          to: { subscriberId: this.subscriberId },
          payload,
        }),
      });

      if (!response.ok) {
        logger.error(
          { workflowId, httpStatus: response.status },
          'Novu trigger failed',
        );
      } else {
        logger.info({ workflowId }, 'Novu notification sent');
      }
    } catch (error) {
      logger.error(
        {
          workflowId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Novu trigger error',
      );
    }
  }
}
