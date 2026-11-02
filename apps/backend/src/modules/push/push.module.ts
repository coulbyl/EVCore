import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PUSH_DELIVERY } from '@config/push.constants';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushRepository } from './push.repository';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BullModule.registerQueue({ name: PUSH_DELIVERY.QUEUE }),
  ],
  controllers: [PushController],
  providers: [PushService, PushRepository],
  exports: [PushService, BullModule],
})
export class PushModule {}
