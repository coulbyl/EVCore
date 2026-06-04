import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '@modules/auth/auth.module';
import { BULLMQ_QUEUES } from '@/config/etl.constants';
import { MlController } from './ml.controller';
import { MlService } from './ml.service';
import { MlRepository } from './ml.repository';

@Module({
  imports: [
    BullModule.registerQueue({ name: BULLMQ_QUEUES.ML_TRAINING }),
    AuthModule,
  ],
  controllers: [MlController],
  providers: [MlService, MlRepository],
  exports: [MlService],
})
export class MlModule {}
