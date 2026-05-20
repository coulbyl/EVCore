import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
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
import { UpdateMeDto } from './dto/update-me.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ConfirmTotpDto } from './dto/confirm-totp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordTotpDto } from './dto/reset-password-totp.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';

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

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async updateMe(
    @CurrentSession() session: AuthSession,
    @Body() body: UpdateMeDto,
  ) {
    const user = await this.authService.updateMe(session.user.id, body);
    return { user };
  }

  @Patch('me/identity')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async updateIdentity(
    @CurrentSession() session: AuthSession,
    @Body() body: UpdateIdentityDto,
  ) {
    const user = await this.authService.updateIdentity(session.user.id, body);
    return { user };
  }

  @Post('send-verification')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async sendVerification(@CurrentSession() session: AuthSession) {
    await this.authService.sendEmailVerification(session.user.id);
    return { status: 'ok' as const };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async verifyEmail(
    @CurrentSession() session: AuthSession,
    @Body() body: VerifyEmailDto,
  ) {
    await this.authService.verifyEmail(session.user.id, body);
    return { status: 'ok' as const };
  }

  @Post('setup-totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async setupTotp(@CurrentSession() session: AuthSession) {
    const result = await this.authService.setupTotp(session.user.id);
    return result;
  }

  @Post('confirm-totp')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  async confirmTotp(
    @CurrentSession() session: AuthSession,
    @Body() body: ConfirmTotpDto,
  ) {
    await this.authService.confirmTotp(session.user.id, body);
    return { status: 'ok' as const };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: RequestPasswordResetDto) {
    await this.authService.requestPasswordReset(body);
    return { status: 'ok' as const };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPassword(body);
    return { status: 'ok' as const };
  }

  @Post('reset-password/totp')
  @HttpCode(HttpStatus.OK)
  async resetPasswordWithTotp(@Body() body: ResetPasswordTotpDto) {
    await this.authService.resetPasswordWithTotp(body);
    return { status: 'ok' as const };
  }
}
