import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { PrismaModule } from '@/prisma.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { FixtureModule } from '@modules/fixture/fixture.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { CouponRepository } from './coupon.repository';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { CouponWorker } from './coupon.worker';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: BULLMQ_QUEUES.BETTING_ENGINE }),
    PrismaModule,
    BettingEngineModule,
    FixtureModule,
    NotificationModule,
  ],
  controllers: [CouponController],
  providers: [CouponRepository, CouponService, CouponWorker],
  exports: [CouponService],
})
export class CouponModule {}
