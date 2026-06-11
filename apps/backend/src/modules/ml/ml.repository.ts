import { Injectable } from '@nestjs/common';
import type { MlModelVersion } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import { ML_COOLDOWN_DAYS } from './ml.constants';

@Injectable()
export class MlRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActive(segment: string): Promise<MlModelVersion | null> {
    return this.prisma.client.mlModelVersion.findFirst({
      where: { isActive: true, segment },
      orderBy: { activatedAt: 'desc' },
    });
  }

  async findAll(): Promise<MlModelVersion[]> {
    return this.prisma.client.mlModelVersion.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdOrThrow(id: string): Promise<MlModelVersion> {
    return this.prisma.client.mlModelVersion.findUniqueOrThrow({
      where: { id },
    });
  }

  async activate(id: string): Promise<MlModelVersion> {
    return this.prisma.client.$transaction(async (tx) => {
      const target = await tx.mlModelVersion.findUniqueOrThrow({
        where: { id },
      });

      await tx.mlModelVersion.updateMany({
        where: { segment: target.segment, isActive: true },
        data: { isActive: false },
      });

      return tx.mlModelVersion.update({
        where: { id },
        data: { isActive: true, activatedAt: new Date() },
      });
    });
  }

  async rollback(targetId: string): Promise<MlModelVersion> {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await tx.mlModelVersion.findUniqueOrThrow({
        where: { id: targetId },
      });

      const previous = await tx.mlModelVersion.findFirst({
        where: { segment: current.segment, id: { not: targetId } },
        orderBy: { createdAt: 'desc' },
      });

      if (!previous) {
        throw new Error(
          `No previous version to roll back to for segment ${current.segment}`,
        );
      }

      await tx.mlModelVersion.update({
        where: { id: targetId },
        data: { isActive: false },
      });

      return tx.mlModelVersion.update({
        where: { id: previous.id },
        data: {
          isActive: true,
          activatedAt: new Date(),
          rollbackOfId: targetId,
        },
      });
    });
  }

  async findLastActivationDate(segment: string): Promise<Date | null> {
    const model = await this.prisma.client.mlModelVersion.findFirst({
      where: { segment, activatedAt: { not: null } },
      orderBy: { activatedAt: 'desc' },
      select: { activatedAt: true },
    });
    return model?.activatedAt ?? null;
  }

  async isCooldownActive(segment: string): Promise<boolean> {
    const lastActivation = await this.findLastActivationDate(segment);
    if (!lastActivation) return false;
    const cooldownMs = ML_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - lastActivation.getTime() < cooldownMs;
  }

  async countNewBetsSince(since: Date): Promise<number> {
    return this.prisma.client.bet.count({
      where: {
        status: { in: ['WON', 'LOST'] },
        updatedAt: { gt: since },
      },
    });
  }

  async findLastCreatedAt(segment: string): Promise<Date | null> {
    const model = await this.prisma.client.mlModelVersion.findFirst({
      where: { segment },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return model?.createdAt ?? null;
  }

  async findRecentlyTrainedUnactivated(
    sinceHours = 24,
  ): Promise<MlModelVersion[]> {
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return this.prisma.client.mlModelVersion.findMany({
      where: { isActive: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteInactive(id: string): Promise<void> {
    const model = await this.prisma.client.mlModelVersion.findUniqueOrThrow({
      where: { id },
      select: { isActive: true },
    });
    if (model.isActive) {
      throw new Error('Cannot delete an active model');
    }
    await this.prisma.client.mlModelVersion.delete({ where: { id } });
  }
}
