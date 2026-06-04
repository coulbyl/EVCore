import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '@/common/guards/admin.guard';
import { AuthSessionGuard } from '@modules/auth/auth-session.guard';
import { AuthService } from '@modules/auth/auth.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminUsersService } from './admin-users.service';

@Controller('admin/users')
@UseGuards(AuthSessionGuard, AdminGuard)
export class AdminUsersController {
  constructor(
    private readonly service: AdminUsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.service.listUsers(query);
  }

  @Patch(':id')
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.service.updateUser(id, dto);
  }

  @Post(':id/reset-password-link')
  @HttpCode(HttpStatus.OK)
  async generateResetPasswordLink(@Param('id') id: string) {
    const resetUrl = await this.authService.generateAdminResetLink(id);
    return { resetUrl };
  }
}
