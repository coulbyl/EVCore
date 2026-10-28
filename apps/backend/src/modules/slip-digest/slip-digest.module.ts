import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SLIP_DIGEST } from '@config/slip-digest.constants';
import { PrismaModule } from '@/prisma.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { PushModule } from '@modules/push/push.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { SlipDigestRepository } from './slip-digest.repository';
import { SlipDigestScheduler } from './slip-digest.scheduler';
import { SlipDigestService } from './slip-digest.service';
import { SlipDigestWorker } from './slip-digest.worker';
import { WeeklyStatementService } from './weekly-statement.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: SLIP_DIGEST.QUEUE }),
    PrismaModule,
    NotificationModule,
    PushModule,
    CouponModule,
  ],
  providers: [
    SlipDigestRepository,
    SlipDigestService,
    WeeklyStatementService,
    SlipDigestScheduler,
    SlipDigestWorker,
  ],
})
export class SlipDigestModule {}
