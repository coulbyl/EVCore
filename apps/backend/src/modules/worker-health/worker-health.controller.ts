import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  WorkerHealthService,
  type WorkerHealth,
} from './worker-health.service';

/**
 * GET /health/worker — anonymous like /health, for the monitoring probe:
 * 200 while the worker process beats, 503 otherwise. Not the API
 * container's healthcheck: a worker down must raise an alert, not restart
 * the API.
 */
@Controller('health')
export class WorkerHealthController {
  constructor(private readonly health: WorkerHealthService) {}

  @Get('worker')
  async getWorker(): Promise<WorkerHealth> {
    const health = await this.health.read();
    if (health.status !== 'ok') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
