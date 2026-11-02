import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { EtlService } from './etl.service';
import { StatsBackfillService } from './stats-backfill.service';

/** Registers the recurring ETL passes when the worker process starts. */
@Injectable()
export class EtlScheduler implements OnApplicationBootstrap {
  constructor(
    private readonly etl: EtlService,
    private readonly statsBackfill: StatsBackfillService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.etl.registerSchedulers();
    await this.statsBackfill.registerScheduler();
  }
}
