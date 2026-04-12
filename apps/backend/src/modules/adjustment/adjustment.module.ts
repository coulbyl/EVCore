import { Module } from '@nestjs/common';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { NotificationModule } from '@modules/notification/notification.module';
import { PrismaModule } from '@/prisma.module';
import { AdjustmentController } from './adjustment.controller';
import { AdjustmentService } from './adjustment.service';
import { CalibrationService } from './calibration.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, BettingEngineModule, NotificationModule, AuthModule],
  controllers: [AdjustmentController],
  providers: [AdjustmentService, CalibrationService],
  exports: [AdjustmentService, CalibrationService],
})
export class AdjustmentModule {}
