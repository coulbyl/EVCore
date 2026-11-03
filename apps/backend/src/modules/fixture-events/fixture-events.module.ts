import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma.module';
import { FixtureEventRepository } from './fixture-event.repository';
import { FixtureLineupRepository } from './fixture-lineup.repository';
import { FixturePlayerStatisticRepository } from './fixture-player-statistic.repository';
import { PlayerRepository } from './player.repository';
import { PlayerSquadRepository } from './player-squad.repository';
import { FixtureEventsService } from './fixture-events.service';

@Module({
  imports: [PrismaModule],
  providers: [
    FixtureEventRepository,
    FixtureLineupRepository,
    FixturePlayerStatisticRepository,
    PlayerRepository,
    PlayerSquadRepository,
    FixtureEventsService,
  ],
  exports: [
    FixtureEventsService,
    FixtureEventRepository,
    PlayerSquadRepository,
  ],
})
export class FixtureEventsModule {}
