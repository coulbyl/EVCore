import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { VerifiedTicketModule } from '@modules/verified-ticket/verified-ticket.module';
import { PlayableOddsRepository } from '@modules/betting-engine/pricing/playable-odds.repository';
import { LegFactRepository } from '@modules/coupon/leg-fact/leg-fact.repository';
import { MatchSheetService } from './match-sheet.service';
import { ResultsController } from './results.controller';
import { ResultsRepository } from './results.repository';
import { ResultsService } from './results.service';
import { WeekService } from './week.service';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { MatchesController } from './matches.controller';
import { MatchesRepository } from './matches.repository';
import { MatchesService } from './matches.service';
import { TodayController } from './today.controller';
import { TodayRepository } from './today.repository';
import { TodayService } from './today.service';
import { MeController } from './me.controller';
import { MeRepository } from './me.repository';
import { MeService } from './me.service';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { SupportRepository } from '@modules/support/support.repository';

/**
 * One aggregate endpoint per player screen (16 § 3): the only place that
 * knows a screen's shape. Composes from repositories, returns a flat DTO.
 */
@Module({
  imports: [AuthModule, CouponModule, VerifiedTicketModule],
  controllers: [
    TodayController,
    MatchesController,
    ResultsController,
    PublicController,
    MeController,
    TicketController,
  ],
  providers: [
    TodayService,
    TodayRepository,
    MatchesService,
    MatchesRepository,
    MatchSheetService,
    ResultsService,
    WeekService,
    PublicService,
    ResultsRepository,
    // The teams' last matches, read as for the leg facts (stateless).
    LegFactRepository,
    // Stateless reader of the prices, registered here as in coupon.module.ts
    // rather than importing the whole engine for one query.
    PlayableOddsRepository,
    MeService,
    TicketService,
    MeRepository,
    // The unread replies of Moi (stateless reader, as above).
    SupportRepository,
  ],
})
export class ScreensModule {}
