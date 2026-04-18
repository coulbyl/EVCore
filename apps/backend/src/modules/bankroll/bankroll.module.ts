import { Module } from '@nestjs/common';
import { AuthModule } from '@modules/auth/auth.module';
import { BankrollController } from './bankroll.controller';
import { BankrollRepository } from './bankroll.repository';
import { BankrollService } from './bankroll.service';

@Module({
  imports: [AuthModule],
  controllers: [BankrollController],
  providers: [BankrollRepository, BankrollService],
  exports: [BankrollService],
})
export class BankrollModule {}
