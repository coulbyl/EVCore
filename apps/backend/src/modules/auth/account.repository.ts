import { Injectable } from '@nestjs/common';
import { EmailCodePurpose, type UserRole } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  findCredentials(
    userId: string,
  ): Promise<{ passwordHash: string; role: UserRole } | null> {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, role: true },
    });
  }

  findPausedUntil(
    userId: string,
  ): Promise<{ pausedUntil: Date | null } | null> {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { pausedUntil: true },
    });
  }

  async setPausedUntil(userId: string, pausedUntil: Date): Promise<void> {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: { pausedUntil },
    });
  }

  async hasBadge(userId: string, badgeCode: string): Promise<boolean> {
    const badge = await this.prisma.client.userBadge.findUnique({
      where: { userId_badgeCode: { userId, badgeCode } },
      select: { id: true },
    });
    return badge !== null;
  }

  findIdentity(
    userId: string,
  ): Promise<{ email: string; username: string } | null> {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, username: true },
    });
  }

  async isEmailTaken(email: string, exceptUserId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findFirst({
      where: { email, NOT: { id: exceptUserId } },
      select: { id: true },
    });
    return user !== null;
  }

  /** Un seul code de changement actif : le nouveau remplace les anciens. */
  async replaceEmailChangeCode(input: {
    userId: string;
    targetEmail: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.emailVerificationCode.updateMany({
        where: {
          userId: input.userId,
          used: false,
          purpose: EmailCodePurpose.CHANGE_EMAIL,
        },
        data: { used: true },
      }),
      this.prisma.client.emailVerificationCode.create({
        data: {
          userId: input.userId,
          codeHash: input.codeHash,
          expiresAt: input.expiresAt,
          purpose: EmailCodePurpose.CHANGE_EMAIL,
          targetEmail: input.targetEmail,
        },
      }),
    ]);
  }

  findActiveEmailChangeCode(
    userId: string,
    now: Date,
  ): Promise<{
    id: string;
    codeHash: string;
    attempts: number;
    targetEmail: string | null;
  } | null> {
    return this.prisma.client.emailVerificationCode.findFirst({
      where: {
        userId,
        used: false,
        purpose: EmailCodePurpose.CHANGE_EMAIL,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, codeHash: true, attempts: true, targetEmail: true },
    });
  }

  async incrementCodeAttempts(codeId: string): Promise<void> {
    await this.prisma.client.emailVerificationCode.update({
      where: { id: codeId },
      data: { attempts: { increment: 1 } },
    });
  }

  /**
   * Le code est consommé et l'adresse remplacée dans la même transaction.
   * Une adresse prise entre-temps lève P2002 (unicité de `users.email`).
   */
  async confirmEmailChange(input: {
    codeId: string;
    userId: string;
    email: string;
  }): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.emailVerificationCode.update({
        where: { id: input.codeId },
        data: { used: true },
      }),
      this.prisma.client.user.update({
        where: { id: input.userId },
        data: { email: input.email, emailVerified: true },
      }),
    ]);
  }

  /** Fichiers joints à la conversation de support, stockés hors base. */
  async findAttachmentKeys(userId: string): Promise<string[]> {
    const rows = await this.prisma.client.supportAttachment.findMany({
      where: { message: { conversation: { userId } } },
      select: { objectKey: true },
    });
    return rows.map((row) => row.objectKey);
  }

  /**
   * Supprime le compte et tout ce qui lui appartient. Toutes les tables liées
   * suppriment en cascade (sessions, coupons, mouvements, notifications,
   * support, badges…), sauf `bet.userId` qui passe à NULL : les paris créés
   * par le joueur lui sont propres (jamais partagés entre comptes) et sont
   * donc supprimés ensuite, dans la même transaction.
   */
  async deleteUserAndOwnBets(userId: string): Promise<{ bets: number }> {
    return this.prisma.client.$transaction(async (tx) => {
      const bets = await tx.bet.findMany({
        where: { userId },
        select: { id: true },
      });
      await tx.user.delete({ where: { id: userId } });
      const deleted = await tx.bet.deleteMany({
        where: { id: { in: bets.map((bet) => bet.id) }, userId: null },
      });
      return { bets: deleted.count };
    });
  }
}
