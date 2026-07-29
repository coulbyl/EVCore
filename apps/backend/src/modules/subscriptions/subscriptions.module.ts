import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { InvestmentModule } from '@modules/investment/investment.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { PushModule } from '@modules/push/push.module';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionMatchingService } from './subscription-matching.service';
import { SubscriptionSettlementService } from './subscription-settlement.service';

@Module({
  imports: [AuthModule, InvestmentModule, BettingEngineModule, PushModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsRepository,
    SubscriptionsService,
    SubscriptionMatchingService,
    SubscriptionSettlementService,
  ],
  exports: [SubscriptionMatchingService, SubscriptionSettlementService],
})
export class SubscriptionsModule {}
