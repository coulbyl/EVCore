import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { BankrollService } from './bankroll.service';
import { DepositDto } from './dto/deposit.dto';
import { GetTransactionsQueryDto } from './dto/get-transactions-query.dto';

@Controller('bankroll')
@UseGuards(AuthSessionGuard)
export class BankrollController {
  constructor(private readonly bankrollService: BankrollService) {}

  @Get('balance')
  getBalance(@CurrentSession() session: AuthSession) {
    return this.bankrollService.getBalance(session.user.id);
  }

  @Get('transactions')
  getTransactions(
    @CurrentSession() session: AuthSession,
    @Query() query: GetTransactionsQueryDto,
  ) {
    return this.bankrollService.getTransactions({
      userId: session.user.id,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit,
    });
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  deposit(@CurrentSession() session: AuthSession, @Body() body: DepositDto) {
    return this.bankrollService.deposit(
      session.user.id,
      body.amount,
      body.note,
    );
  }
}
