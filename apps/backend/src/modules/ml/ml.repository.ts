import { Injectable } from '@nestjs/common';
import type { MlModelVersion } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

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
}
