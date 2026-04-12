import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { FixtureRepository } from './fixture.repository';
import { FixtureService } from './fixture.service';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringController } from './fixture-scoring.controller';
import { MatchLegDetectionService } from './match-leg-detection.service';

@Module({
  imports: [PrismaModule],
  controllers: [FixtureScoringController],
  providers: [
    FixtureRepository,
    FixtureService,
    FixtureScoringService,
    MatchLegDetectionService,
  ],
  exports: [FixtureService, MatchLegDetectionService],
})
export class FixtureModule {}
