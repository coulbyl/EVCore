import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { PushService } from './push.service';
import { PushRepository } from './push.repository';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { UnsubscribePushDto } from './dto/unsubscribe-push.dto';

@Controller('push')
@UseGuards(AuthSessionGuard)
export class PushController {
  constructor(
    private readonly service: PushService,
    private readonly repo: PushRepository,
  ) {}

  @Get('vapid-public-key')
  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.service.getPublicKey() };
  }

  @Post('subscribe')
  async subscribe(
    @CurrentSession() session: AuthSession,
    @Body() body: SubscribePushDto,
  ): Promise<{ ok: true }> {
    await this.repo.upsertSubscription({
      userId: session.user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: body.userAgent,
    });
    return { ok: true };
  }

  @Delete('subscribe')
  async unsubscribe(@Body() body: UnsubscribePushDto): Promise<{ ok: true }> {
    await this.repo.deleteByEndpoint(body.endpoint);
    return { ok: true };
  }
}
