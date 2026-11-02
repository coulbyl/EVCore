import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import {
  CONSOLE_PASSES,
  CONSOLE_QUEUES,
  CONSOLE_WATCH,
} from '@config/console.constants';
import { AppSettingModule } from '@modules/app-setting/app-setting.module';
import { AuthModule } from '@modules/auth/auth.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { EtlModule } from '@modules/etl/etl.module';
import { MailModule } from '@modules/mail/mail.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { ScreensModule } from '@modules/screens/screens.module';
import { ConsoleEngineService } from './console-engine.service';
import { ConsolePlayersService } from './console-players.service';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleQueuesService } from './console-queues.service';
import { ConsoleSettleService } from './console-settle.service';
import { ConsoleSettingsService } from './console-settings.service';
import { ConsoleWatchService } from './console-watch.service';
import { ConsoleExploitationController } from './console-exploitation.controller';
import { ConsoleIntegrationsController } from './console-integrations.controller';
import { ConsoleController } from './console.controller';
import { ConsoleRepository } from './console.repository';
import { ConsoleService } from './console.service';

/** The admin's screens (docs/refonte-ui/12-admin.md), phase G. */
@Module({
  imports: [
    AppSettingModule,
    AuthModule,
    BettingEngineModule,
    CouponModule,
    DashboardModule,
    EtlModule,
    MailModule,
    NotificationModule,
    ScreensModule,
    BullModule.registerQueue({ name: CONSOLE_WATCH.QUEUE }),
    // The passes' queues, read for their last runs (vantage-analysis is the
    // vantage-worker's, on the same Redis).
    ...[
      ...new Set([
        ...CONSOLE_PASSES.map((p) => p.queue),
        ...CONSOLE_QUEUES.map((q) => q.queue),
      ]),
    ]
      .filter((name) => name !== CONSOLE_WATCH.QUEUE)
      .map((name) => BullModule.registerQueue({ name })),
  ],
  controllers: [
    ConsoleController,
    ConsoleExploitationController,
    ConsoleIntegrationsController,
  ],
  providers: [
    ConsoleService,
    ConsoleRepository,
    ConsolePassesService,
    ConsoleEngineService,
    ConsolePlayersService,
    ConsoleSettingsService,
    ConsoleQueuesService,
    ConsoleSettleService,
    ConsoleWatchService,
  ],
  // The watch and its queue: ConsoleWorkerModule runs the ten-minute check.
  exports: [ConsoleService, ConsoleWatchService, BullModule],
})
export class ConsoleModule {}
