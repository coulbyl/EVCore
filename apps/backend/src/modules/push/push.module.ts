import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushRepository } from './push.repository';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushController],
  providers: [PushService, PushRepository],
  exports: [PushService],
})
export class PushModule {}
