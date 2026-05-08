import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Controller('admin/announcements')
@UseGuards(AuthSessionGuard)
export class AdminAnnouncementsController {
  constructor(private readonly service: AnnouncementsService) {}

  private assertAdmin(session: AuthSession): void {
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }

  @Get()
  listAdmin(@CurrentSession() session: AuthSession) {
    this.assertAdmin(session);
    return this.service.listAdmin();
  }

  @Post()
  create(
    @CurrentSession() session: AuthSession,
    @Body() dto: CreateAnnouncementDto,
  ) {
    this.assertAdmin(session);
    return this.service.create(session.user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    this.assertAdmin(session);
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentSession() session: AuthSession, @Param('id') id: string) {
    this.assertAdmin(session);
    return this.service.remove(id);
  }
}
