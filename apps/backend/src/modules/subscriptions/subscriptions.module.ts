import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { InvestmentModule } from '@modules/investment/investment.module';
import { BettingEngineModule } from '@modules/betting-engine/betting-engine.module';
import { PushModule } from '@modules/push/push.module';
import { BULLMQ_QUEUES } from '@config/etl.constants';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionMatchingService } from './subscription-matching.service';
import { SubscriptionSettlementService } from './subscription-settlement.service';

@Module({
  imports: [
    AuthModule,
    InvestmentModule,
    BettingEngineModule,
    PushModule,
    // Même queue que EtlModule (nom partagé, deux enregistrements client
    // pointant sur la même queue BullMQ/Redis) — juste pour pouvoir déclencher
    // un run différé à la création d'un abonnement (SubscriptionsService),
    // sans dépendre du gros EtlModule et créer un cycle d'imports (EtlModule
    // importe déjà SubscriptionsModule pour son propre worker).
    BullModule.registerQueue({ name: BULLMQ_QUEUES.SUBSCRIPTION_MATCHING }),
  ],
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
