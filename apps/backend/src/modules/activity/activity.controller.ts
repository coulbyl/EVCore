import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { AdminGuard } from '@/common/guards/admin.guard';
import { ActivityService } from './activity.service';
import { RetentionService, type RetentionView } from './retention.service';
import { RecordEventDto } from './dto/record-event.dto';

/** Quelques actions produit, liste fermée, joueur connecté seulement. */
@Controller('events')
@UseGuards(AuthSessionGuard)
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async record(
    @CurrentSession() session: AuthSession,
    @Body() body: RecordEventDto,
  ): Promise<void> {
    await this.activity.recordEvent({
      userId: session.user.id,
      type: body.type,
      ...(body.notificationType
        ? { payload: { notificationType: body.notificationType } }
        : {}),
    });
  }
}

/** Tableau de fidélisation : admin seulement. */
@Controller('dashboard/retention')
@UseGuards(AuthSessionGuard, AdminGuard)
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get()
  getRetention(): Promise<RetentionView> {
    return this.retention.getRetention();
  }
}
