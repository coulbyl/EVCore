import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { BetController } from './bet.controller';
import { BetService } from './bet.service';

@Module({
  imports: [AuthModule],
  controllers: [BetController],
  providers: [BetService],
})
export class BetModule {}
