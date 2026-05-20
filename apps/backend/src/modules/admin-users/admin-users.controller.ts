import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AuthService } from '@modules/auth/auth.service';
import { CurrentSession } from '@modules/auth/current-session.decorator';
import type { AuthSession } from '@modules/auth/auth.types';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(AuthSessionGuard)
export class AdminUsersController {
  constructor(
    private readonly service: AdminUsersService,
    private readonly authService: AuthService,
  ) {}

  private assertAdmin(session: AuthSession): void {
    if (session.user.role !== 'ADMIN') {
      throw new ForbiddenException('Admin only');
    }
  }

  @Get()
  listUsers(
    @CurrentSession() session: AuthSession,
    @Query() query: ListUsersQueryDto,
  ) {
    this.assertAdmin(session);
    return this.service.listUsers(query);
  }

  @Patch(':id')
  updateUser(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    this.assertAdmin(session);
    return this.service.updateUser(id, dto);
  }

  @Post(':id/reset-password-link')
  @HttpCode(HttpStatus.OK)
  async generateResetPasswordLink(
    @CurrentSession() session: AuthSession,
    @Param('id') id: string,
  ) {
    this.assertAdmin(session);
    const resetUrl = await this.authService.generateAdminResetLink(id);
    return { resetUrl };
  }
}
