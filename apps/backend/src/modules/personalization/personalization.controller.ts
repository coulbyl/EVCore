import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { PersonalizationService } from './personalization.service';

@Controller('personalization')
@UseGuards(AuthSessionGuard)
export class PersonalizationController {
  constructor(private readonly service: PersonalizationService) {}

  @Get()
  get(@CurrentSession() session: AuthSession) {
    return this.service.getPersonalization(session.user.id);
  }

  @Get('leagues/catalog')
  getLeagueCatalog() {
    return this.service.getLeagueCatalog();
  }

  @Post('leagues/:code')
  @HttpCode(200)
  async followLeague(
    @CurrentSession() session: AuthSession,
    @Param('code') code: string,
  ) {
    await this.service.followLeague(session.user.id, code);
    return { followed: true };
  }

  @Delete('leagues/:code')
  @HttpCode(200)
  async unfollowLeague(
    @CurrentSession() session: AuthSession,
    @Param('code') code: string,
  ) {
    await this.service.unfollowLeague(session.user.id, code);
    return { followed: false };
  }

  @Get('channels/discover')
  discoverChannels(@CurrentSession() session: AuthSession) {
    return this.service.discoverChannels(session.user.id);
  }

  @Post('channels/:channel')
  @HttpCode(200)
  async followChannel(
    @CurrentSession() session: AuthSession,
    @Param('channel') channel: string,
  ) {
    await this.service.followChannel(session.user.id, channel);
    return { followed: true };
  }

  @Delete('channels/:channel')
  @HttpCode(200)
  async unfollowChannel(
    @CurrentSession() session: AuthSession,
    @Param('channel') channel: string,
  ) {
    await this.service.unfollowChannel(session.user.id, channel);
    return { followed: false };
  }
}
