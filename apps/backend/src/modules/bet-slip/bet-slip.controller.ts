import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { BetSlipService } from './bet-slip.service';
import { CreateBetSlipDto } from './dto/create-bet-slip.dto';

@Controller('bet-slips')
@UseGuards(AuthSessionGuard)
export class BetSlipController {
  constructor(private readonly betSlipService: BetSlipService) {}

  @Get('summary')
  getSummary(
    @CurrentSession() session: AuthSession,
    @Query('date') date?: string,
  ) {
    const parsed = date ? new Date(date) : undefined;
    return this.betSlipService.getSummary(session.user.id, parsed);
  }

  @Get()
  list(
    @CurrentSession() session: AuthSession,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(`${to}T23:59:59.999Z`) : undefined;
    return this.betSlipService.list(session.user.id, fromDate, toDate);
  }

  @Get(':id')
  getById(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    return this.betSlipService.getById(session.user.id, id);
  }

  @Post()
  create(
    @CurrentSession() session: AuthSession,
    @Body() body: CreateBetSlipDto,
  ) {
    return this.betSlipService.create(session.user.id, body);
  }
}
