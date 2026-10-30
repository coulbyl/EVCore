import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { MailService } from '@modules/mail/mail.service';
import { createLogger } from '@utils/logger';
import { AccountRepository } from './account.repository';
import { SessionCache } from './session-cache';
import {
  OTP_CODE_TTL_MS,
  OTP_EXPIRES_IN_MINUTES,
  OTP_MAX_ATTEMPTS,
} from './auth.constants';
import {
  generateOtpCode,
  hashOtpCode,
  normalizeIdentifier,
  verifyPassword,
} from './auth.utils';

const logger = createLogger('email-change');

/** « fannan@exemple.com » → « f***@exemple.com », pour l'ancienne adresse. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Changement d'adresse e-mail (2026-10-28). Avant, n'importe quelle session
 * pouvait remplacer l'adresse sans mot de passe ni code. Il faut maintenant
 * le mot de passe, puis le code envoyé à la NOUVELLE adresse ; l'ancienne
 * est prévenue une fois le changement fait.
 */
@Injectable()
export class EmailChangeService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly mail: MailService,
    private readonly sessionCache: SessionCache,
  ) {}

  async request(
    userId: string,
    input: { newEmail: string; password: string },
  ): Promise<void> {
    const newEmail = normalizeIdentifier(input.newEmail);
    const credentials = await this.repository.findCredentials(userId);
    const identity = await this.repository.findIdentity(userId);
    if (!credentials || !identity) {
      throw new NotFoundException('Compte introuvable');
    }
    // 400 et non 401 : un 401 déconnecterait le joueur (même règle que la
    // suppression du compte).
    if (!(await verifyPassword(input.password, credentials.passwordHash))) {
      throw new BadRequestException('Mot de passe incorrect.');
    }
    if (newEmail === identity.email) {
      throw new BadRequestException("C'est déjà l'adresse de ton compte.");
    }
    // Adresse déjà prise : on prévient son propriétaire au lieu d'envoyer un
    // code, et on répond comme si le code était parti. Un 409 ici laissait
    // tester quelles adresses ont un compte (revue du lot 2).
    if (await this.repository.isEmailTaken(newEmail, userId)) {
      await this.mail.sendEmailChangeTaken(newEmail);
      return;
    }

    const code = generateOtpCode();
    await this.repository.replaceEmailChangeCode({
      userId,
      targetEmail: newEmail,
      codeHash: hashOtpCode(code),
      expiresAt: new Date(Date.now() + OTP_CODE_TTL_MS),
    });
    await this.mail.sendEmailChangeCode(newEmail, {
      username: identity.username,
      code,
      expiresInMinutes: OTP_EXPIRES_IN_MINUTES,
    });
  }

  async confirm(userId: string, code: string): Promise<{ email: string }> {
    const record = await this.repository.findActiveEmailChangeCode(
      userId,
      new Date(),
    );
    if (!record?.targetEmail) {
      throw new BadRequestException('Code expiré ou invalide.');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Trop de tentatives : demande un nouveau code.',
      );
    }
    if (record.codeHash !== hashOtpCode(code)) {
      await this.repository.incrementCodeAttempts(record.id);
      throw new BadRequestException('Code incorrect.');
    }

    const identity = await this.repository.findIdentity(userId);
    if (!identity) throw new NotFoundException('Compte introuvable');
    const email = record.targetEmail;
    if (await this.repository.isEmailTaken(email, userId)) {
      throw new ConflictException('Cette adresse est déjà utilisée.');
    }
    try {
      await this.repository.confirmEmailChange({
        codeId: record.id,
        userId,
        email,
      });
    } catch (error) {
      // Prise par un autre compte entre la vérification et l'écriture.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Cette adresse est déjà utilisée.');
      }
      throw error;
    }
    this.sessionCache.invalidateUser(userId);

    await this.mail.sendEmailChanged(identity.email, {
      username: identity.username,
      newEmail: maskEmail(email),
    });
    logger.info({ userId }, 'E-mail address changed by its owner');
    return { email };
  }
}
