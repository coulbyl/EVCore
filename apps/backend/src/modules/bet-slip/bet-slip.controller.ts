import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { BetSlipService } from './bet-slip.service';
import { CreateBetSlipDto } from './dto/create-bet-slip.dto';

@Controller('bet-slips')
@UseGuards(AuthSessionGuard)
export class BetSlipController {
  constructor(private readonly betSlipService: BetSlipService) {}

  @Get()
  list(@CurrentSession() session: AuthSession) {
    return this.betSlipService.list(session.user.id);
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
