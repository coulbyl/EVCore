import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
