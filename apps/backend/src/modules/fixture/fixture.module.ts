import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { FixtureRepository } from './fixture.repository';
import { FixtureService } from './fixture.service';
import { MatchLegDetectionService } from './match-leg-detection.service';

@Module({
  imports: [PrismaModule],
  providers: [FixtureRepository, FixtureService, MatchLegDetectionService],
  exports: [FixtureService, MatchLegDetectionService],
})
export class FixtureModule {}
