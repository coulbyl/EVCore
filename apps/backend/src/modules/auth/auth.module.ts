import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from '@modules/mail/mail.module';
import { AUTH_LOGIN_RATE_LIMIT } from '@config/rate-limit.constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionGuard } from './auth-session.guard';

@Module({
  imports: [
    MailModule,
    ThrottlerModule.forRoot([
      { ttl: AUTH_LOGIN_RATE_LIMIT.ttlMs, limit: AUTH_LOGIN_RATE_LIMIT.limit },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionGuard],
  exports: [AuthService, AuthSessionGuard],
})
export class AuthModule {}
