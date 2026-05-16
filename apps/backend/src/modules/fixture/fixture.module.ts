import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FixtureRepository } from './fixture.repository';
import { FixtureService } from './fixture.service';
import { FixtureScoringService } from './fixture-scoring.service';
import { FixtureScoringController } from './fixture-scoring.controller';
import { MatchLegDetectionService } from './match-leg-detection.service';
import { StandingRepository } from './standing.repository';
import { StandingController } from './standing.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [FixtureScoringController, StandingController],
  providers: [
    FixtureRepository,
    FixtureService,
    FixtureScoringService,
    MatchLegDetectionService,
    StandingRepository,
  ],
  exports: [FixtureService, MatchLegDetectionService, StandingRepository],
})
export class FixtureModule {}
