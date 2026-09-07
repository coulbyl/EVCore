import { Module } from '@nestjs/common';
import { MailModule } from '@modules/mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSessionGuard } from './auth-session.guard';

// The app-wide ThrottlerModule (see app.module.ts) already covers every
// route via APP_GUARD — a second ThrottlerModule.forRoot() here previously
// silently won the shared 'default' throttler config for the WHOLE app
// (not just this module), capping every route at the login-specific 5/min
// instead of the intended 300/min. Login gets its stricter limit via
// @Throttle() on the route itself (see auth.controller.ts).
@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionGuard],
  exports: [AuthService, AuthSessionGuard],
})
export class AuthModule {}
