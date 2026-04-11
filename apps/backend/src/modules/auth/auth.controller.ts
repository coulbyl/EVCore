import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentSession } from './current-session.decorator';
import { AuthSessionGuard } from './auth-session.guard';
import type { AuthSession } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.register(body);
    this.authService.applySessionCookie(response, result.token);
    return { session: result.session };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    this.authService.applySessionCookie(response, result.token);
    return { session: result.session };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async logout(
    @CurrentSession() _session: AuthSession,
    @Req() request: Parameters<AuthService['logout']>[0],
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request);
    this.authService.clearSessionCookie(response);
    return { status: 'ok' as const };
  }

  @Get('me')
  @UseGuards(AuthSessionGuard)
  me(@CurrentSession() session: AuthSession) {
    return { session };
  }
}
