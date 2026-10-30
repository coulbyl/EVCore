import { Module, forwardRef } from '@nestjs/common';
import { ActivityModule } from '@modules/activity/activity.module';
import { AdminOrServiceTokenGuard } from './admin-or-service-token.guard';
import { EmailChangeService } from './email-change.service';
import { MailModule } from '@modules/mail/mail.module';
import { StorageModule } from '@modules/storage/storage.module';
import { AccountRepository } from './account.repository';
import { AccountDeletionService } from './account-deletion.service';
import { AccountPauseService } from './account-pause.service';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthSessionGuard } from './auth-session.guard';

// The app-wide ThrottlerModule (see app.module.ts) already covers every
// route via APP_GUARD — a second ThrottlerModule.forRoot() here previously
// silently won the shared 'default' throttler config for the WHOLE app
// (not just this module), capping every route at the login-specific 5/min
// instead of the intended 300/min. Login gets its stricter limit via
// @Throttle() on the route itself (see auth.controller.ts).
@Module({
  imports: [MailModule, StorageModule, forwardRef(() => ActivityModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSessionGuard,
    AdminOrServiceTokenGuard,
    AccountDeletionService,
    AccountPauseService,
    EmailChangeService,
    AccountRepository,
    AuthRepository,
  ],
  exports: [
    AuthService,
    AuthSessionGuard,
    AdminOrServiceTokenGuard,
    ActivityModule,
  ],
})
export class AuthModule {}
