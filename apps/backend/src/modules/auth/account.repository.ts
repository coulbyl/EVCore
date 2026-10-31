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

  findIdentity(
    userId: string,
  ): Promise<{ email: string; fullName: string } | null> {
    return this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
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
   * Supprime le compte et tout ce qui lui appartient : toutes les tables
   * liées suppriment en cascade (sessions, suivis, notifications, support…).
   * Les paris déclarés, seuls à ne pas suivre la cascade, sont partis le
   * 2026-10-31.
   */
  async deleteUser(userId: string): Promise<void> {
    await this.prisma.client.user.delete({ where: { id: userId } });
  }
}
