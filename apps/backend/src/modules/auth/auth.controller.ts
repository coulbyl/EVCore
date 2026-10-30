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
import { Throttle } from '@nestjs/throttler';
import { AUTH_LOGIN_RATE_LIMIT } from '@config/rate-limit.constants';
import { AuthService } from './auth.service';
import { AccountDeletionService } from './account-deletion.service';
import { AccountPauseService } from './account-pause.service';
import { EmailChangeService } from './email-change.service';
import { CurrentSession } from './current-session.decorator';
import { AuthSessionGuard } from './auth-session.guard';
import type { AuthSession } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { LoginTotpDto } from './dto/login-totp.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ConfirmTotpDto } from './dto/confirm-totp.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordTotpDto } from './dto/reset-password-totp.dto';
import { UpdateIdentityDto } from './dto/update-identity.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { PauseAccountDto } from './dto/pause-account.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';

@Controller('auth')
export class AuthController {
  // eslint-disable-next-line max-params -- Nest DI constructor: one service per account concern.
  constructor(
    private readonly authService: AuthService,
    private readonly accountDeletion: AccountDeletionService,
    private readonly accountPause: AccountPauseService,
    private readonly emailChange: EmailChangeService,
  ) {}

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
  // Overrides the app-wide 'default' throttler (see app.module.ts) with a
  // much stricter one just for this route — the global ThrottlerGuard
  // (APP_GUARD) already covers every route, so no extra guard is needed
  // here, only a tighter limit.
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(body);
    if (result.kind === 'totp') {
      // Pas de session avant le code de l'application (11 § 3).
      return { totpRequired: true as const, challenge: result.challenge };
    }
    this.authService.applySessionCookie(response, result.token);
    return { session: result.session };
  }

  @Post('login/totp')
  @HttpCode(HttpStatus.OK)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  async loginWithTotp(
    @Body() body: LoginTotpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.loginWithTotp(body);
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

  // POST plutôt que DELETE : le mot de passe voyage dans le corps, que
  // certains proxys retirent d'une requête DELETE. Même limite que le login
  // contre l'essai de mots de passe.
  @Post('me/delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  async deleteMe(
    @CurrentSession() session: AuthSession,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.accountDeletion.deleteAccount(session.user.id, body.password);
    this.authService.clearSessionCookie(response);
    return { status: 'ok' as const };
  }

  // Changement d'adresse : mot de passe, puis code envoyé à la nouvelle
  // adresse. Même limite que le login contre l'essai de mots de passe et de
  // codes.
  @Post('me/email/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  async requestEmailChange(
    @CurrentSession() session: AuthSession,
    @Body() body: RequestEmailChangeDto,
  ) {
    await this.emailChange.request(session.user.id, body);
    return { status: 'ok' as const };
  }

  @Post('me/email/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  confirmEmailChange(
    @CurrentSession() session: AuthSession,
    @Body() body: ConfirmEmailChangeDto,
  ) {
    return this.emailChange.confirm(session.user.id, body.code);
  }

  // Pas d'endpoint pour lever la pause : elle se prolonge, elle ne s'annule
  // pas avant sa fin.
  @Post('me/pause')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthSessionGuard)
  pauseMe(
    @CurrentSession() session: AuthSession,
    @Body() body: PauseAccountDto,
  ) {
    return this.accountPause.pause(session.user.id, body.days);
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
  @Throttle({
    default: {
      limit: AUTH_LOGIN_RATE_LIMIT.limit,
      ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs,
    },
  })
  async resetPasswordWithTotp(@Body() body: ResetPasswordTotpDto) {
    await this.authService.resetPasswordWithTotp(body);
    return { status: 'ok' as const };
  }
}
