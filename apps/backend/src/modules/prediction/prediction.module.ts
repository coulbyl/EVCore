import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { PredictionRepository } from './prediction.repository';
import { PredictionService } from './prediction.service';
import { PredictionController } from './prediction.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PredictionController],
  providers: [PredictionRepository, PredictionService],
  exports: [PredictionService],
})
export class PredictionModule {}
