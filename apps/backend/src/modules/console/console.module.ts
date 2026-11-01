import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONSOLE_PASSES, CONSOLE_WATCH } from '@config/console.constants';
import { AppSettingModule } from '@modules/app-setting/app-setting.module';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { EtlModule } from '@modules/etl/etl.module';
import { MailModule } from '@modules/mail/mail.module';
import { ScreensModule } from '@modules/screens/screens.module';
import { ConsoleEngineService } from './console-engine.service';
import { ConsolePlayersService } from './console-players.service';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleSettingsService } from './console-settings.service';
import {
  ConsoleWatchScheduler,
  ConsoleWatchWorker,
} from './console-watch.scheduler';
import { ConsoleWatchService } from './console-watch.service';
import { ConsoleController } from './console.controller';
import { ConsoleRepository } from './console.repository';
import { ConsoleService } from './console.service';

/** The admin's screens (docs/refonte-ui/12-admin.md), phase G. */
@Module({
  imports: [
    AppSettingModule,
    AuthModule,
    CouponModule,
    DashboardModule,
    EtlModule,
    MailModule,
    ScreensModule,
    BullModule.registerQueue({ name: CONSOLE_WATCH.QUEUE }),
    // The passes' queues, read for their last runs (vantage-analysis is the
    // vantage-worker's, on the same Redis).
    ...[...new Set(CONSOLE_PASSES.map((p) => p.queue))].map((name) =>
      BullModule.registerQueue({ name }),
    ),
  ],
  controllers: [ConsoleController],
  providers: [
    ConsoleService,
    ConsoleRepository,
    ConsolePassesService,
    ConsoleEngineService,
    ConsolePlayersService,
    ConsoleSettingsService,
    ConsoleWatchService,
    ConsoleWatchScheduler,
    ConsoleWatchWorker,
  ],
  exports: [ConsoleService],
})
export class ConsoleModule {}
