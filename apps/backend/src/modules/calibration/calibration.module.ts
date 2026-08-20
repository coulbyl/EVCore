import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { ChannelMarketCalibrationRepository } from './channel-market-calibration.repository';

@Module({
  imports: [PrismaModule],
  providers: [ChannelMarketCalibrationRepository],
  exports: [ChannelMarketCalibrationRepository],
})
export class CalibrationModule {}
