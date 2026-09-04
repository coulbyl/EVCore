import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';
import { PersonalizationController } from './personalization.controller';
import { PersonalizationService } from './personalization.service';
import { PersonalizationRepository } from './personalization.repository';

@Module({
  imports: [AuthModule, DashboardModule],
  controllers: [PersonalizationController],
  providers: [PersonalizationService, PersonalizationRepository],
})
export class PersonalizationModule {}
