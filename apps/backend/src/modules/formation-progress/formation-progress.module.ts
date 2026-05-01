import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { FormationProgressController } from './formation-progress.controller';
import { FormationProgressRepository } from './formation-progress.repository';
import { FormationProgressService } from './formation-progress.service';

@Module({
  imports: [AuthModule],
  controllers: [FormationProgressController],
  providers: [FormationProgressRepository, FormationProgressService],
})
export class FormationProgressModule {}
