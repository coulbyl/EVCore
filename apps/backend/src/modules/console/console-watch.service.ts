import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONSOLE_WATCH } from '@config/console.constants';
import { NotificationService } from '@modules/notification/notification.service';
import { createLogger } from '@utils/logger';
import { LIGHT_NAMES, todoLineOf } from './console-lines';
import { ConsoleRepository } from './console.repository';
import { ConsoleService } from './console.service';
import type { ConsoleStatus, LightKey } from './console.types';

const logger = createLogger('console-watch');

/**
 * Every ten minutes: the lights are read and recorded; a light that has
 * turned red since its last e-mail sends one, with a push to the admins
 * (12-admin.md § 1). The e-mail
 * is claimed in the table before it leaves: a replay, a second worker or a
 * light staying red never sends it twice; going back to green and red
 * again does.
 */
@Injectable()
export class ConsoleWatchService {
  // eslint-disable-next-line max-params -- NestJS constructor injection: the lights, their table, the alerts, the app URL
  constructor(
    private readonly console: ConsoleService,
    private readonly repository: ConsoleRepository,
    private readonly alerts: NotificationService,
    private readonly config: ConfigService,
  ) {}

  async check(
    now: Date = new Date(),
  ): Promise<{ red: LightKey[]; sent: LightKey[] }> {
    const status = await this.console.getStatus(now);
    const sent: LightKey[] = [];
    const lights = Object.entries(status.lights) as [LightKey, string][];
    for (const [light, state] of lights) {
      await this.repository.recordLight({ light, state, now });
      // Passes cut on purpose (Réglages): the home says so in red; an
      // e-mail would only report the operator's own decision.
      if (state !== 'red' || status.passesOff) continue;
      if (!(await this.repository.claimRedNotice(light, now))) continue;
      try {
        await this.send({ light, status, now });
      } catch (err) {
        // Released: the next check tries again instead of staying silent.
        await this.repository.releaseRedNotice(light, now);
        throw err;
      }
      sent.push(light);
      logger.warn({ light }, 'Console light turned red — e-mail sent');
    }
    return {
      red: lights.filter(([, state]) => state === 'red').map(([l]) => l),
      sent,
    };
  }

  private send(input: {
    light: LightKey;
    status: ConsoleStatus;
    now: Date;
  }): Promise<void> {
    const { light, status, now } = input;
    return this.alerts.sendOpsLightRed({
      light: LIGHT_NAMES[light],
      since: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC',
      lines: status.todo
        .filter((item) => item.light === light && item.severity === 'red')
        .map(todoLineOf),
      url: `${this.config.get<string>('APP_URL', '')}${CONSOLE_WATCH.HOME_PATH}`,
    });
  }
}
