import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { RollingStatsService } from './rolling-stats.service';
import { RollingStatsController } from './rolling-stats.controller';

@Module({
  imports: [PrismaModule],
  controllers: [RollingStatsController],
  providers: [RollingStatsService],
  exports: [RollingStatsService],
})
export class RollingStatsModule {}
