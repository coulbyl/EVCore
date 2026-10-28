import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@evcore/db';
import { StorageService } from '@modules/storage/storage.service';
import { createLogger } from '@utils/logger';
import { AccountRepository } from './account.repository';
import { verifyPassword } from './auth.utils';

const logger = createLogger('account-deletion');

/**
 * Suppression du compte en libre-service (décision du 2026-10-28) : un droit
 * du joueur sur ses données, qui passait jusqu'ici par un e-mail à l'équipe.
 * Effet immédiat, sans délai de grâce : la confirmation par mot de passe
 * protège contre l'erreur, un délai inviterait à revenir.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly repository: AccountRepository,
    private readonly storage: StorageService,
  ) {}

  async deleteAccount(userId: string, password: string): Promise<void> {
    const credentials = await this.repository.findCredentials(userId);
    if (!credentials) throw new NotFoundException('Compte introuvable');
    // Un admin supprimé par erreur peut laisser l'administration sans
    // personne : ce compte se supprime depuis l'administration.
    if (credentials.role === UserRole.ADMIN) {
      throw new ForbiddenException(
        "Un compte administrateur ne se supprime pas depuis l'application.",
      );
    }
    // 400 et non 401 : un 401 ferait croire au client que la session a
    // expiré et le déconnecterait avant qu'il puisse réessayer.
    if (!(await verifyPassword(password, credentials.passwordHash))) {
      throw new BadRequestException('Mot de passe incorrect.');
    }

    const attachmentKeys = await this.repository.findAttachmentKeys(userId);
    const { bets } = await this.repository.deleteUserAndOwnBets(userId);
    // Après la transaction : un fichier orphelin ne bloque rien, un compte à
    // moitié supprimé si.
    await Promise.all(
      attachmentKeys.map((key) => this.storage.deleteObject(key)),
    );
    logger.info(
      { userId, bets, attachments: attachmentKeys.length },
      'Account deleted by its owner',
    );
  }
}
