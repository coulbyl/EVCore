import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller('subscriptions')
@UseGuards(AuthSessionGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  // Déclaré avant ':id' pour que 'catalog' ne soit jamais matché comme un id.
  @Get('catalog')
  getCatalog() {
    return this.subscriptionsService.getCatalog();
  }

  @Post()
  create(
    @CurrentSession() session: AuthSession,
    @Body() body: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(session.user.id, body);
  }

  @Get()
  list(@CurrentSession() session: AuthSession) {
    return this.subscriptionsService.list(session.user.id);
  }

  @Get(':id')
  getDetail(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    return this.subscriptionsService.getDetail(id, session.user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    return this.subscriptionsService.cancel(id, session.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    return this.subscriptionsService.remove(id, session.user.id);
  }
}
