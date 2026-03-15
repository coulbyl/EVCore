import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { RollingStatsService } from './rolling-stats.service';

@Module({
  imports: [PrismaModule],
  providers: [RollingStatsService],
  exports: [RollingStatsService],
})
export class RollingStatsModule {}
