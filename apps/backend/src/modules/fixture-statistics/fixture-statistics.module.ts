import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { FixtureStatisticsRepository } from './fixture-statistics.repository';
import { FixtureStatisticsService } from './fixture-statistics.service';

@Module({
  imports: [PrismaModule],
  providers: [FixtureStatisticsRepository, FixtureStatisticsService],
  exports: [FixtureStatisticsService],
})
export class FixtureStatisticsModule {}
