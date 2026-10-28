import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { ActivityRepository } from './activity.repository';
import { ActivityService } from './activity.service';
import { RetentionRepository } from './retention.repository';
import { RetentionService } from './retention.service';
import { ActivityController, RetentionController } from './activity.controller';

// AuthModule importe ActivityModule (le garde de session écrit les jours
// actifs) et ActivityModule a besoin du garde pour ses routes : forwardRef.
@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [ActivityController, RetentionController],
  providers: [
    ActivityRepository,
    ActivityService,
    RetentionRepository,
    RetentionService,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
