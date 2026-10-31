import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONSOLE_PASSES } from '@config/console.constants';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { EtlModule } from '@modules/etl/etl.module';
import { ConsolePassesService } from './console-passes.service';
import { ConsoleController } from './console.controller';
import { ConsoleRepository } from './console.repository';
import { ConsoleService } from './console.service';

/** The admin's screens (docs/refonte-ui/12-admin.md), phase G. */
@Module({
  imports: [
    AuthModule,
    CouponModule,
    EtlModule,
    // The passes' queues, read for their last runs (vantage-analysis is the
    // vantage-worker's, on the same Redis).
    ...[...new Set(CONSOLE_PASSES.map((p) => p.queue))].map((name) =>
      BullModule.registerQueue({ name }),
    ),
  ],
  controllers: [ConsoleController],
  providers: [ConsoleService, ConsoleRepository, ConsolePassesService],
  exports: [ConsoleService],
})
export class ConsoleModule {}
