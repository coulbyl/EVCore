import { Injectable } from '@nestjs/common';
import type { UserRole } from '@evcore/db';
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
